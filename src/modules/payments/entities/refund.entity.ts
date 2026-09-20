import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Order } from '../../orders/entities/order.entity';
import { Payment } from './payment.entity';
import { ColumnNumericTransformer } from '../../../common/transformers/numeric.transformer';

export enum RefundStatus {
  PENDING = 'PENDING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  CANCELED = 'CANCELED',
}

@Entity('refunds')
export class Refund {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'payment_id' })
  paymentId!: string;

  @ManyToOne(() => Payment, (payment) => payment.refunds, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payment_id' })
  payment!: Payment;

  @Column({ name: 'order_id' })
  orderId!: string;

  @ManyToOne(() => Order, (order) => order.refunds, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Column({ name: 'stripe_refund_id', type: 'varchar', unique: true, nullable: true })
  stripeRefundId!: string | null;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  amount!: number;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Column({ type: 'enum', enum: RefundStatus, default: RefundStatus.PENDING })
  status!: RefundStatus;

  @Column({ name: 'processed_by_user_id', type: 'uuid', nullable: true })
  processedByUserId!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
