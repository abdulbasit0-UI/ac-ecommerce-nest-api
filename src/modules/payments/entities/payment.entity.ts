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
import { Order } from '../../orders/entities/order.entity';
import { Refund } from './refund.entity';
import { ColumnNumericTransformer } from '../../../common/transformers/numeric.transformer';

export enum PaymentStatus {
  REQUIRES_PAYMENT = 'REQUIRES_PAYMENT',
  PROCESSING = 'PROCESSING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
  CANCELED = 'CANCELED',
  REFUNDED = 'REFUNDED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'order_id' })
  orderId!: string;

  @ManyToOne(() => Order, (order) => order.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;

  @Column({ name: 'stripe_payment_intent_id', unique: true })
  stripePaymentIntentId!: string;

  @Column({ name: 'stripe_charge_id', type: 'varchar', nullable: true })
  stripeChargeId!: string | null;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  amount!: number;

  @Column({ default: 'usd' })
  currency!: string;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.REQUIRES_PAYMENT })
  status!: PaymentStatus;

  @Column({ default: 'card' })
  method!: string;

  @Column({ name: 'raw_payload', type: 'jsonb', nullable: true })
  rawPayload!: Record<string, unknown> | null;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt!: Date | null;

  @OneToMany(() => Refund, (refund) => refund.payment)
  refunds!: Refund[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
