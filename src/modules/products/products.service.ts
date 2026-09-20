import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Product } from './entities/product.entity';
import { ProductImage } from './entities/product-image.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { paginate } from '../../common/dto/pagination-query.dto';
import { slugify } from '../../common/utils/slug.util';
import { RedisService } from '../redis/redis.service';
import { AddProductImageDto } from './dto/add-product-image.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(ProductImage) private readonly images: Repository<ProductImage>,
    private readonly cache: RedisService,
  ) {}

  async create(dto: CreateProductDto): Promise<Product> {
    const slug = dto.slug ? slugify(dto.slug) : slugify(dto.name);
    const product = this.products.create({
      ...dto,
      slug,
      description: dto.description ?? null,
      compareAtPrice: dto.compareAtPrice ?? null,
      categoryId: dto.categoryId ?? null,
      attributes: dto.attributes ?? null,
    });
    const saved = await this.products.save(product);
    await this.cache.delByPrefix('products:');
    return saved;
  }

  async findPublic(query: QueryProductsDto) {
    const cacheKey = `products:list:${JSON.stringify(query)}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const qb = this.products
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.images', 'images')
      .leftJoinAndSelect('product.category', 'category')
      .where('product.isActive = true');

    if (query.search) {
      qb.andWhere('(product.name ILIKE :search OR product.sku ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }
    if (query.categoryId) {
      qb.andWhere('product.categoryId = :categoryId', { categoryId: query.categoryId });
    }
    if (query.featured) {
      qb.andWhere('product.isFeatured = true');
    }
    if (query.minPrice !== undefined) {
      qb.andWhere('product.price >= :minPrice', { minPrice: query.minPrice });
    }
    if (query.maxPrice !== undefined) {
      qb.andWhere('product.price <= :maxPrice', { maxPrice: query.maxPrice });
    }

    qb.orderBy('product.createdAt', 'DESC').skip(query.skip).take(query.limit);
    const [items, total] = await qb.getManyAndCount();
    const result = paginate(items, total, query.page, query.limit);
    await this.cache.set(cacheKey, result, 60);
    return result;
  }

  async findAdmin(query: QueryProductsDto) {
    const [items, total] = await this.products.findAndCount({
      where: query.search ? [{ name: ILike(`%${query.search}%`) }, { sku: ILike(`%${query.search}%`) }] : {},
      relations: { images: true, category: true },
      skip: query.skip,
      take: query.limit,
      order: { createdAt: 'DESC' },
      withDeleted: true,
    });
    return paginate(items, total, query.page, query.limit);
  }

  async findById(id: string): Promise<Product> {
    const product = await this.products.findOne({
      where: { id },
      relations: { images: true, category: true },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  async findBySlug(slug: string): Promise<Product> {
    const product = await this.products.findOne({
      where: { slug, isActive: true },
      relations: { images: true, category: true },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.findById(id);
    Object.assign(product, dto);
    if (dto.slug) product.slug = slugify(dto.slug);
    const saved = await this.products.save(product);
    await this.cache.delByPrefix('products:');
    return saved;
  }

  async remove(id: string): Promise<void> {
    const product = await this.findById(id);
    await this.products.softRemove(product);
    await this.cache.delByPrefix('products:');
  }

  async addImage(productId: string, dto: AddProductImageDto): Promise<ProductImage> {
    const product = await this.findById(productId);
    if (dto.isPrimary) {
      await this.images.update({ productId: product.id }, { isPrimary: false });
    }
    const image = this.images.create({
      productId: product.id,
      key: dto.key,
      url: dto.url,
      alt: dto.alt ?? product.name,
      isPrimary: dto.isPrimary ?? false,
      sortOrder: dto.sortOrder ?? 0,
    });
    const saved = await this.images.save(image);
    await this.cache.delByPrefix('products:');
    return saved;
  }

  async assertInStock(productId: string, quantity: number): Promise<Product> {
    const product = await this.findById(productId);
    if (!product.isActive) {
      throw new BadRequestException('Product is not available');
    }
    if (product.stockQuantity < quantity) {
      throw new BadRequestException(`Insufficient stock for ${product.name}`);
    }
    return product;
  }

  async decrementStock(productId: string, quantity: number): Promise<void> {
    await this.products.decrement({ id: productId }, 'stockQuantity', quantity);
    await this.cache.delByPrefix('products:');
  }

  async incrementStock(productId: string, quantity: number): Promise<void> {
    await this.products.increment({ id: productId }, 'stockQuantity', quantity);
    await this.cache.delByPrefix('products:');
  }
}
