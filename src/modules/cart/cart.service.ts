import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cart } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';
import { CustomersService } from '../customers/customers.service';
import { ProductsService } from '../products/products.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart) private readonly carts: Repository<Cart>,
    @InjectRepository(CartItem) private readonly items: Repository<CartItem>,
    private readonly customers: CustomersService,
    private readonly products: ProductsService,
  ) {}

  async getOrCreate(userId: string): Promise<Cart> {
    const customer = await this.customers.findByUserId(userId);
    let cart = await this.carts.findOne({
      where: { customerId: customer.id },
      relations: { items: { product: { images: true } } },
    });
    if (!cart) {
      cart = await this.carts.save(this.carts.create({ customerId: customer.id, items: [] }));
    }
    return cart;
  }

  async addItem(userId: string, dto: AddCartItemDto): Promise<Cart> {
    const cart = await this.getOrCreate(userId);
    await this.products.assertInStock(dto.productId, dto.quantity);
    const existing = cart.items.find((item) => item.productId === dto.productId);
    if (existing) {
      const nextQty = existing.quantity + dto.quantity;
      await this.products.assertInStock(dto.productId, nextQty);
      existing.quantity = nextQty;
      await this.items.save(existing);
    } else {
      await this.items.save(
        this.items.create({ cartId: cart.id, productId: dto.productId, quantity: dto.quantity }),
      );
    }
    return this.getOrCreate(userId);
  }

  async updateItem(userId: string, itemId: string, quantity: number): Promise<Cart> {
    const cart = await this.getOrCreate(userId);
    const item = cart.items.find((entry) => entry.id === itemId);
    if (!item) {
      throw new NotFoundException('Cart item not found');
    }
    if (quantity <= 0) {
      await this.items.remove(item);
    } else {
      await this.products.assertInStock(item.productId, quantity);
      item.quantity = quantity;
      await this.items.save(item);
    }
    return this.getOrCreate(userId);
  }

  async clear(userId: string): Promise<void> {
    const cart = await this.getOrCreate(userId);
    if (cart.items.length) {
      await this.items.remove(cart.items);
    }
  }

  summarize(cart: Cart) {
    const items = cart.items.map((item) => ({
      ...item,
      lineTotal: Number(item.product.price) * item.quantity,
    }));
    const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
    return { ...cart, items, subtotal };
  }
}
