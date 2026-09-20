import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationQueryDto, paginate } from '../../common/dto/pagination-query.dto';
import { RolesService } from '../roles/roles.service';
import { RoleName } from '../../common/constants/roles.constant';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly roles: RolesService,
  ) {}

  async create(dto: CreateUserDto, roleName: RoleName = RoleName.CUSTOMER): Promise<User> {
    const existing = await this.users.findOne({ where: { email: dto.email.toLowerCase() } });
    if (existing) {
      throw new BadRequestException('Email is already registered');
    }
    const role = dto.roleId ? await this.roles.findById(dto.roleId) : await this.roles.findByName(roleName);
    const user = this.users.create({
      email: dto.email.toLowerCase(),
      passwordHash: await bcrypt.hash(dto.password, 12),
      firstName: dto.firstName,
      lastName: dto.lastName,
      role,
      roleId: role.id,
      isEmailVerified: dto.isEmailVerified ?? false,
    });
    return this.users.save(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({
      where: { email: email.toLowerCase() },
      relations: { role: { permissions: true }, customer: true },
    });
  }

  async findById(id: string): Promise<User> {
    const user = await this.users.findOne({
      where: { id },
      relations: { role: { permissions: true }, customer: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async list(query: PaginationQueryDto) {
    const [items, total] = await this.users.findAndCount({
      skip: query.skip,
      take: query.limit,
      order: { createdAt: 'DESC' },
      relations: { role: true },
    });
    return paginate(items, total, query.page, query.limit);
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);
    if (dto.roleId) {
      const role = await this.roles.findById(dto.roleId);
      user.role = role;
      user.roleId = role.id;
    }
    if (dto.firstName) user.firstName = dto.firstName;
    if (dto.lastName) user.lastName = dto.lastName;
    if (typeof dto.isActive === 'boolean') user.isActive = dto.isActive;
    return this.users.save(user);
  }

  async setPassword(user: User, password: string): Promise<void> {
    user.passwordHash = await bcrypt.hash(password, 12);
    await this.users.save(user);
  }

  async markEmailVerified(user: User): Promise<void> {
    user.isEmailVerified = true;
    await this.users.save(user);
  }

  async touchLastLogin(user: User): Promise<void> {
    user.lastLoginAt = new Date();
    await this.users.save(user);
  }

  async comparePassword(user: User, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findById(id);
    await this.users.softRemove(user);
  }
}
