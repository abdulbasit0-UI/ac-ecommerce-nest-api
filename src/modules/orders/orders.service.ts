import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Order, OrderAddressSnapshot, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { CartService } from '../cart/cart.service';
import { CustomersService } from '../customers/customers.service';
import { ProductsService } from '../products/products.service';
import { PaymentsService } from '../payments/payments.service';
import { CheckoutDto } from './dto/checkout.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { paginate } from '../../common/dto/pagination-query.dto';
import { createOrderNumber } from '../../common/utils/order-number.util';
import { User } from '../users/entities/user.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    private readonly dataSource: DataSource,
    private readonly cart: CartService,
    private readonly customers: CustomersService,
    private readonly products: ProductsService,
    @Inject(forwardRef(() => PaymentsService))
    private readonly payments: PaymentsService,
  ) {}

  async checkout(user: User, dto: CheckoutDto) {
    const customer = await this.customers.findByUserId(user.id);
    const cart = await this.cart.getOrCreate(user.id);
    if (!cart.items.length) {
      throw new BadRequestException('Cart is empty');
    }

    const shippingAddress = await this.resolveAddress(user.id, dto);
    const taxRate = 0.08;
    const shipping = cart.items.length ? 9.99 : 0;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let saved: Order;
    try {
      for (const item of cart.items) {
        await this.products.assertInStock(item.productId, item.quantity);
      }

      const orderItems = cart.items.map((item) => {
        const unitPrice = Number(item.product.price);
        return queryRunner.manager.create(OrderItem, {
          productId: item.productId,
          productName: item.product.name,
          sku: item.product.sku,
          quantity: item.quantity,
          unitPrice,
          lineTotal: Number((unitPrice * item.quantity).toFixed(2)),
        });
      });

      const subtotal = Number(orderItems.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2));
      const tax = Number((subtotal * taxRate).toFixed(2));
      const total = Number((subtotal + tax + shipping).toFixed(2));

      const order = queryRunner.manager.create(Order, {
        orderNumber: createOrderNumber(),
        customerId: customer.id,
        status: OrderStatus.PENDING_PAYMENT,
        subtotal,
        tax,
        shipping,
        total,
        currency: 'usd',
        shippingAddress,
        notes: dto.notes ?? null,
        items: orderItems,
        statusHistory: [
          queryRunner.manager.create(OrderStatusHistory, {
            fromStatus: null,
            toStatus: OrderStatus.PENDING_PAYMENT,
            note: 'Order created from checkout',
            changedByUserId: user.id,
          }),
        ],
      });

      saved = await queryRunner.manager.save(Order, order);
      await queryRunner.commitTransaction();
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      await queryRunner.release();
    }

    try {
      const payment = await this.payments.createIntent(saved);
      saved.stripePaymentIntentId = payment.stripePaymentIntentId;
      await this.orders.save(saved);
      await this.cart.clear(user.id);

      return {
        order: await this.findById(saved.id),
        clientSecret: payment.clientSecret,
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Payment setup failed';
      throw new BadRequestException(`Order was created but Stripe payment setup failed: ${detail}`);
    }
  }

  async listMine(userId: string, query: QueryOrdersDto) {
    const customer = await this.customers.findByUserId(userId);
    const [items, total] = await this.orders.findAndCount({
      where: { customerId: customer.id, ...(query.status ? { status: query.status } : {}) },
      skip: query.skip,
      take: query.limit,
      order: { createdAt: 'DESC' },
      relations: { items: true, payments: true, refunds: true },
    });
    return paginate(items, total, query.page, query.limit);
  }

  async listAll(query: QueryOrdersDto) {
    const [items, total] = await this.orders.findAndCount({
      where: query.status ? { status: query.status } : {},
      skip: query.skip,
      take: query.limit,
      order: { createdAt: 'DESC' },
      relations: { items: true, customer: { user: true }, payments: true, refunds: true },
    });
    return paginate(items, total, query.page, query.limit);
  }

  async findById(id: string): Promise<Order> {
    const order = await this.orders.findOne({
      where: { id },
      relations: { items: true, payments: true, refunds: true, statusHistory: true, customer: { user: true } },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  async findMine(userId: string, orderId: string): Promise<Order> {
    const customer = await this.customers.findByUserId(userId);
    const order = await this.findById(orderId);
    if (order.customerId !== customer.id) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  async syncPayment(userId: string, orderId: string) {
    await this.findMine(userId, orderId);
    return this.payments.syncFromStripe(orderId);
  }

  async updateStatus(orderId: string, status: OrderStatus, userId: string, note?: string): Promise<Order> {
    const order = await this.findById(orderId);
    this.assertTransition(order.status, status);
    await this.transition(order, status, userId, note);
    return this.findById(order.id);
  }

  async markPaid(orderId: string): Promise<Order> {
    const order = await this.findById(orderId);
    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      return order;
    }
    for (const item of order.items) {
      if (item.productId) {
        await this.products.decrementStock(item.productId, item.quantity);
      }
    }
    order.paidAt = new Date();
    await this.transition(order, OrderStatus.PAID, null, 'Stripe payment succeeded');
    return this.findById(order.id);
  }

  async markRefunded(orderId: string, fully: boolean): Promise<Order> {
    const order = await this.findById(orderId);
    const next = fully ? OrderStatus.REFUNDED : OrderStatus.PARTIALLY_REFUNDED;
    if (fully) {
      for (const item of order.items) {
        if (item.productId) {
          await this.products.incrementStock(item.productId, item.quantity);
        }
      }
    }
    await this.transition(order, next, null, 'Stripe refund processed');
    return this.findById(order.id);
  }

  async cancel(userId: string, orderId: string): Promise<Order> {
    const order = await this.findMine(userId, orderId);
    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new BadRequestException('Only unpaid orders can be cancelled by the customer');
    }
    order.cancelledAt = new Date();
    await this.transition(order, OrderStatus.CANCELLED, userId, 'Cancelled by customer');
    return this.findById(order.id);
  }

  private async transition(
    order: Order,
    status: OrderStatus,
    userId: string | null,
    note?: string,
  ): Promise<void> {
    const from = order.status;
    order.status = status;
    await this.orders.save(order);
    await this.orders.manager.save(
      OrderStatusHistory,
      this.orders.manager.create(OrderStatusHistory, {
        orderId: order.id,
        fromStatus: from,
        toStatus: status,
        changedByUserId: userId,
        note: note ?? null,
      }),
    );
  }

  private assertTransition(from: OrderStatus, to: OrderStatus) {
    const allowed: Record<OrderStatus, OrderStatus[]> = {
      [OrderStatus.PENDING_PAYMENT]: [OrderStatus.PAID, OrderStatus.CANCELLED],
      [OrderStatus.PAID]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED, OrderStatus.REFUND_REQUESTED],
      [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.REFUND_REQUESTED],
      [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED, OrderStatus.REFUND_REQUESTED],
      [OrderStatus.DELIVERED]: [OrderStatus.REFUND_REQUESTED],
      [OrderStatus.CANCELLED]: [],
      [OrderStatus.REFUND_REQUESTED]: [OrderStatus.PARTIALLY_REFUNDED, OrderStatus.REFUNDED],
      [OrderStatus.PARTIALLY_REFUNDED]: [OrderStatus.REFUNDED],
      [OrderStatus.REFUNDED]: [],
    };
    if (!allowed[from].includes(to)) {
      throw new BadRequestException(`Cannot move order from ${from} to ${to}`);
    }
  }

  private async resolveAddress(userId: string, dto: CheckoutDto): Promise<OrderAddressSnapshot> {
    if (dto.shippingAddress) {
      return {
        line1: dto.shippingAddress.line1,
        line2: dto.shippingAddress.line2 ?? null,
        city: dto.shippingAddress.city,
        state: dto.shippingAddress.state ?? null,
        postalCode: dto.shippingAddress.postalCode,
        country: dto.shippingAddress.country,
      };
    }
    if (dto.shippingAddressId) {
      const addresses = await this.customers.listAddresses(userId);
      const match = addresses.find((address) => address.id === dto.shippingAddressId);
      if (!match) {
        throw new BadRequestException('Shipping address not found');
      }
      return {
        line1: match.line1,
        line2: match.line2,
        city: match.city,
        state: match.state,
        postalCode: match.postalCode,
        country: match.country,
      };
    }
    const addresses = await this.customers.listAddresses(userId);
    const fallback = addresses.find((address) => address.isDefault) ?? addresses[0];
    if (!fallback) {
      throw new BadRequestException('Add a shipping address before checkout');
    }
    return {
      line1: fallback.line1,
      line2: fallback.line2,
      city: fallback.city,
      state: fallback.state,
      postalCode: fallback.postalCode,
      country: fallback.country,
    };
  }
}
