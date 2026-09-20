import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Category } from '../../categories/entities/category.entity';
import { ProductImage } from './product-image.entity';
import { ColumnNumericTransformer } from '../../../common/transformers/numeric.transformer';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ unique: true })
  slug!: string;

  @Column({ unique: true })
  sku!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: new ColumnNumericTransformer(),
  })
  price!: number;

  @Column({
    name: 'compare_at_price',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  compareAtPrice!: number | null;

  @Column({ default: 'usd' })
  currency!: string;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId!: string | null;

  @ManyToOne(() => Category, (category) => category.products, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'category_id' })
  category!: Category | null;

  @Column({ name: 'stock_quantity', default: 0 })
  stockQuantity!: number;

  @Column({ name: 'low_stock_threshold', default: 5 })
  lowStockThreshold!: number;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ name: 'is_featured', default: false })
  isFeatured!: boolean;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 3,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
  })
  weight!: number | null;

  @Column({ type: 'jsonb', nullable: true })
  attributes!: Record<string, string> | null;

  @OneToMany(() => ProductImage, (image) => image.product, { cascade: true })
  images!: ProductImage[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt!: Date | null;
}
