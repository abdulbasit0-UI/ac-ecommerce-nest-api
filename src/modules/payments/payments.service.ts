import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { Refund, RefundStatus } from './entities/refund.entity';
import { Order } from '../orders/entities/order.entity';
import { OrdersService } from '../orders/orders.service';
import { MailService } from '../mail/mail.service';
import { CreateRefundDto } from './dto/create-refund.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly stripe: Stripe;
  private readonly currency: string;

  constructor(
    config: ConfigService,
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    @InjectRepository(Refund) private readonly refunds: Repository<Refund>,
    @Inject(forwardRef(() => OrdersService)) private readonly orders: OrdersService,
    private readonly mail: MailService,
  ) {
    this.stripe = new Stripe(config.get<string>('stripe.secretKey') as string);
    this.currency = config.get<string>('stripe.currency') ?? 'usd';
  }

  async createIntent(order: Order) {
    const intent = await this.stripe.paymentIntents.create({
      amount: Math.round(order.total * 100),
      currency: this.currency,
      metadata: { orderId: order.id, orderNumber: order.orderNumber },
      automatic_payment_methods: { enabled: true },
    });

    const payment = await this.payments.save(
      this.payments.create({
        orderId: order.id,
        stripePaymentIntentId: intent.id,
        amount: order.total,
        currency: this.currency,
        status: PaymentStatus.REQUIRES_PAYMENT,
        rawPayload: intent as unknown as Record<string, unknown>,
      }),
    );

    return { ...payment, clientSecret: intent.client_secret };
  }

  async handleWebhook(rawBody: Buffer, signature: string, webhookSecret: string): Promise<{ received: true }> {
    let event: Stripe.Event;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (error) {
      this.logger.warn(`Stripe signature verification failed: ${(error as Error).message}`);
      throw new BadRequestException('Invalid Stripe signature');
    }

    const normalizedType = event.type.startsWith('v1.') ? event.type.slice(3) : event.type;
    const object = event.data.object as { id?: string };

    switch (normalizedType) {
      case 'payment_intent.succeeded': {
        this.logger.log(`Handling ${event.type} ${event.id}`);
        const intent = await this.resolvePaymentIntent(object.id);
        if (intent) await this.onPaymentSucceeded(intent);
        break;
      }
      case 'payment_intent.payment_failed': {
        this.logger.log(`Handling ${event.type} ${event.id}`);
        const intent = await this.resolvePaymentIntent(object.id);
        if (intent) await this.onPaymentFailed(intent);
        break;
      }
      case 'charge.refunded':
        this.logger.log(`Handling ${event.type} ${event.id}`);
        await this.onChargeRefunded(event.data.object as Stripe.Charge);
        break;
      default:
        this.logger.log(`Ignoring Stripe event ${event.type} ${event.id}`);
    }

    return { received: true };
  }

  async refund(orderId: string, dto: CreateRefundDto, userId: string) {
    const payment = await this.payments.findOne({
      where: { orderId },
      order: { createdAt: 'DESC' },
    });
    if (
      !payment ||
      ![PaymentStatus.SUCCEEDED, PaymentStatus.PARTIALLY_REFUNDED].includes(payment.status)
    ) {
      throw new NotFoundException('No successful payment found for this order');
    }

    const alreadyRefunded = (await this.refunds.find({ where: { paymentId: payment.id } })).reduce(
      (sum, refund) => sum + Number(refund.amount),
      0,
    );
    const remaining = Number(payment.amount) - alreadyRefunded;
    if (dto.amount > remaining) {
      throw new BadRequestException(`Refund exceeds remaining capturable amount (${remaining})`);
    }

    const stripeRefund = await this.stripe.refunds.create({
      payment_intent: payment.stripePaymentIntentId,
      amount: Math.round(dto.amount * 100),
      reason: 'requested_by_customer',
      metadata: { orderId, processedBy: userId },
    });

    const refund = await this.refunds.save(
      this.refunds.create({
        paymentId: payment.id,
        orderId,
        stripeRefundId: stripeRefund.id,
        amount: dto.amount,
        reason: dto.reason ?? null,
        status: RefundStatus.SUCCEEDED,
        processedByUserId: userId,
      }),
    );

    const fully = dto.amount >= remaining;
    payment.status = fully ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED;
    await this.payments.save(payment);
    const order = await this.orders.markRefunded(orderId, fully);

    if (order.customer?.user?.email) {
      await this.mail.sendRefundProcessed(
        order.customer.user.email,
        order.customer.user.firstName,
        order.orderNumber,
        `$${dto.amount.toFixed(2)}`,
      );
    }

    return refund;
  }

  listForOrder(orderId: string) {
    return this.payments.find({
      where: { orderId },
      relations: { refunds: true },
      order: { createdAt: 'DESC' },
    });
  }

  async syncFromStripe(orderId: string) {
    const payment = await this.payments.findOne({
      where: { orderId },
      order: { createdAt: 'DESC' },
    });
    if (!payment) {
      throw new NotFoundException('No payment found for this order');
    }
    const intent = await this.stripe.paymentIntents.retrieve(payment.stripePaymentIntentId);
    this.logger.log(`Stripe sync for ${intent.id}: ${intent.status}`);
    if (intent.status === 'succeeded') {
      await this.onPaymentSucceeded(intent);
    } else if (intent.status === 'canceled' || intent.status === 'requires_payment_method') {
      await this.onPaymentFailed(intent);
    }
    return this.orders.findById(orderId);
  }

  private async resolvePaymentIntent(id?: string): Promise<Stripe.PaymentIntent | null> {
    if (!id) {
      return null;
    }
    return this.stripe.paymentIntents.retrieve(id);
  }

  private async onPaymentSucceeded(intent: Stripe.PaymentIntent) {
    const payment = await this.payments.findOne({ where: { stripePaymentIntentId: intent.id } });
    if (!payment) {
      this.logger.warn(`No local payment row for PaymentIntent ${intent.id}`);
      return;
    }
    if (payment.status === PaymentStatus.SUCCEEDED) {
      return;
    }
    payment.status = PaymentStatus.SUCCEEDED;
    payment.paidAt = new Date();
    payment.stripeChargeId = typeof intent.latest_charge === 'string' ? intent.latest_charge : null;
    payment.rawPayload = intent as unknown as Record<string, unknown>;
    await this.payments.save(payment);

    const order = await this.orders.markPaid(payment.orderId);
    if (order.customer?.user?.email) {
      await this.mail.sendOrderConfirmed(
        order.customer.user.email,
        order.customer.user.firstName,
        order.orderNumber,
        `$${Number(order.total).toFixed(2)}`,
      );
    }
  }

  private async onPaymentFailed(intent: Stripe.PaymentIntent) {
    const payment = await this.payments.findOne({ where: { stripePaymentIntentId: intent.id } });
    if (!payment) {
      return;
    }
    payment.status = PaymentStatus.FAILED;
    payment.rawPayload = intent as unknown as Record<string, unknown>;
    await this.payments.save(payment);
  }

  private async onChargeRefunded(charge: Stripe.Charge) {
    const intentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
    if (!intentId) {
      return;
    }
    const payment = await this.payments.findOne({ where: { stripePaymentIntentId: intentId } });
    if (!payment) {
      return;
    }
    const refunded = (charge.amount_refunded ?? 0) / 100;
    const fully = refunded >= Number(payment.amount);
    payment.status = fully ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED;
    await this.payments.save(payment);
  }
}
