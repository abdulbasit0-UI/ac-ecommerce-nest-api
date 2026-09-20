import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@ApiTags('cart')
@ApiBearerAuth('access-token')
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}

  @Get()
  async get(@CurrentUser() user: User) {
    return this.cart.summarize(await this.cart.getOrCreate(user.id));
  }

  @Post('items')
  async add(@CurrentUser() user: User, @Body() dto: AddCartItemDto) {
    return this.cart.summarize(await this.cart.addItem(user.id, dto));
  }

  @Patch('items/:itemId')
  async update(
    @CurrentUser() user: User,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cart.summarize(await this.cart.updateItem(user.id, itemId, dto.quantity));
  }

  @Delete()
  clear(@CurrentUser() user: User) {
    return this.cart.clear(user.id);
  }
}
