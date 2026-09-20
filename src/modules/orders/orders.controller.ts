import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { CheckoutDto } from './dto/checkout.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PermissionSlug } from '../../common/constants/permissions.constant';

@ApiTags('orders')
@ApiBearerAuth('access-token')
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('checkout')
  checkout(@CurrentUser() user: User, @Body() dto: CheckoutDto) {
    return this.orders.checkout(user, dto);
  }

  @Get('me')
  mine(@CurrentUser() user: User, @Query() query: QueryOrdersDto) {
    return this.orders.listMine(user.id, query);
  }

  @Get('me/:id')
  findMine(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.findMine(user.id, id);
  }

  @Post('me/:id/sync-payment')
  syncPayment(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.syncPayment(user.id, id);
  }

  @Post('me/:id/cancel')
  cancel(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.cancel(user.id, id);
  }

  @Get()
  @RequirePermissions(PermissionSlug.ORDERS_READ)
  list(@Query() query: QueryOrdersDto) {
    return this.orders.listAll(query);
  }

  @Get(':id')
  @RequirePermissions(PermissionSlug.ORDERS_READ)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.orders.findById(id);
  }

  @Patch(':id/status')
  @RequirePermissions(PermissionSlug.ORDERS_WRITE)
  updateStatus(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orders.updateStatus(id, dto.status, user.id, dto.note);
  }
}
