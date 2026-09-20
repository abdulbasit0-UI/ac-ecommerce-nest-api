import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  type RawBodyRequest,
} from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { PaymentsService } from './payments.service';
import { CreateRefundDto } from './dto/create-refund.dto';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PermissionSlug } from '../../common/constants/permissions.constant';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly payments: PaymentsService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @SkipThrottle()
  @ApiExcludeEndpoint()
  @Post('webhooks/stripe')
  webhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const raw = this.readRawBody(request);
    if (!raw?.length) {
      this.logger.error('Stripe webhook missing raw body; signature cannot be verified');
      throw new BadRequestException('Stripe webhook missing raw body');
    }
    if (!signature) {
      this.logger.error('Stripe webhook missing stripe-signature header');
      throw new BadRequestException('Stripe webhook missing signature');
    }
    this.logger.log(`Stripe webhook received (${raw.length} bytes)`);
    return this.payments.handleWebhook(
      raw,
      signature,
      this.config.get<string>('stripe.webhookSecret') as string,
    );
  }

  private readRawBody(request: RawBodyRequest<Request>): Buffer | undefined {
    if (Buffer.isBuffer(request.rawBody)) {
      return request.rawBody;
    }
    if (typeof request.rawBody === 'string') {
      return Buffer.from(request.rawBody);
    }
    if (Buffer.isBuffer(request.body)) {
      return request.body;
    }
    return undefined;
  }

  @ApiBearerAuth('access-token')
  @Get('orders/:orderId')
  @RequirePermissions(PermissionSlug.PAYMENTS_READ)
  list(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.payments.listForOrder(orderId);
  }

  @ApiBearerAuth('access-token')
  @Post('orders/:orderId/refunds')
  @RequirePermissions(PermissionSlug.PAYMENTS_REFUND)
  refund(
    @CurrentUser() user: User,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: CreateRefundDto,
  ) {
    return this.payments.refund(orderId, dto, user.id);
  }
}
