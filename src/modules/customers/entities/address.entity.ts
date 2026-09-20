import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Customer } from './customer.entity';

export enum AddressType {
  SHIPPING = 'SHIPPING',
  BILLING = 'BILLING',
}

@Entity('addresses')
export class Address {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'customer_id' })
  customerId!: string;

  @ManyToOne(() => Customer, (customer) => customer.addresses, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer!: Customer;

  @Column({ default: 'Home' })
  label!: string;

  @Column({ type: 'enum', enum: AddressType, default: AddressType.SHIPPING })
  type!: AddressType;

  @Column({ name: 'line1' })
  line1!: string;

  @Column({ name: 'line2', type: 'varchar', nullable: true })
  line2!: string | null;

  @Column()
  city!: string;

  @Column({ type: 'varchar', nullable: true })
  state!: string | null;

  @Column({ name: 'postal_code' })
  postalCode!: string;

  @Column()
  country!: string;

  @Column({ name: 'is_default', default: false })
  isDefault!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
