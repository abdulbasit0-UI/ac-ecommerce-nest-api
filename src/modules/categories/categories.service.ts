import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Category } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { slugify } from '../../common/utils/slug.util';
import { RedisService } from '../redis/redis.service';

const CATEGORY_CACHE = 'categories:tree';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category) private readonly categories: Repository<Category>,
    private readonly cache: RedisService,
  ) {}

  async create(dto: CreateCategoryDto): Promise<Category> {
    const slug = dto.slug ? slugify(dto.slug) : slugify(dto.name);
    const existing = await this.categories.findOne({ where: { slug } });
    if (existing) {
      throw new ConflictException('Category slug already exists');
    }
    const category = this.categories.create({
      ...dto,
      slug,
      description: dto.description ?? null,
      imageUrl: dto.imageUrl ?? null,
      parentId: dto.parentId ?? null,
    });
    const saved = await this.categories.save(category);
    await this.cache.del(CATEGORY_CACHE);
    return saved;
  }

  async findTree() {
    const cached = await this.cache.get<Category[]>(CATEGORY_CACHE);
    if (cached) {
      return cached;
    }
    const roots = await this.categories.find({
      where: { parentId: IsNull(), isActive: true },
      relations: { children: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
    await this.cache.set(CATEGORY_CACHE, roots, 300);
    return roots;
  }

  async findAll() {
    return this.categories.find({ order: { sortOrder: 'ASC', name: 'ASC' } });
  }

  async findById(id: string): Promise<Category> {
    const category = await this.categories.findOne({ where: { id }, relations: { children: true, parent: true } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.findById(id);
    Object.assign(category, dto);
    if (dto.name && !dto.slug) {
      category.slug = slugify(dto.name);
    }
    if (dto.slug) {
      category.slug = slugify(dto.slug);
    }
    const saved = await this.categories.save(category);
    await this.cache.del(CATEGORY_CACHE);
    return saved;
  }

  async remove(id: string): Promise<void> {
    const category = await this.findById(id);
    await this.categories.remove(category);
    await this.cache.del(CATEGORY_CACHE);
  }
}
