import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Customer } from '../../customers/entities/customer.entity';
import { OrderItem } from './order-item.entity';
import { Payment } from '../../payments/entities/payment.entity';
import { Refund } from '../../payments/entities/refund.entity';
import { OrderStatusHistory } from './order-status-history.entity';
import { ColumnNumericTransformer } from '../../../common/transformers/numeric.transformer';
import { OrderStatus } from './order-status.enum';

export { OrderStatus } from './order-status.enum';

export interface OrderAddressSnapshot {
  line1: string;
  line2?: string | null;
  city: string;
  state?: string | null;
  postalCode: string;
  country: string;
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'order_number', unique: true })
  orderNumber!: string;

  @Column({ name: 'customer_id' })
  customerId!: string;

  @ManyToOne(() => Customer, (customer) => customer.orders, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customer_id' })
  customer!: Customer;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING_PAYMENT })
  status!: OrderStatus;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  subtotal!: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  tax!: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
    transformer: new ColumnNumericTransformer(),
  })
  shipping!: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  total!: number;

  @Column({ default: 'usd' })
  currency!: string;

  @Column({ name: 'shipping_address', type: 'jsonb' })
  shippingAddress!: OrderAddressSnapshot;

  @Column({ name: 'billing_address', type: 'jsonb', nullable: true })
  billingAddress!: OrderAddressSnapshot | null;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({ name: 'stripe_payment_intent_id', type: 'varchar', nullable: true })
  stripePaymentIntentId!: string | null;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt!: Date | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt!: Date | null;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true, eager: true })
  items!: OrderItem[];

  @OneToMany(() => Payment, (payment) => payment.order)
  payments!: Payment[];

  @OneToMany(() => Refund, (refund) => refund.order)
  refunds!: Refund[];

  @OneToMany(() => OrderStatusHistory, (history) => history.order, { cascade: true })
  statusHistory!: OrderStatusHistory[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
