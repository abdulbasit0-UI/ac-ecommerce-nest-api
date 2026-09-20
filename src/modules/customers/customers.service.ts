import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from './entities/customer.entity';
import { Address } from './entities/address.entity';
import { User } from '../users/entities/user.entity';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { PaginationQueryDto, paginate } from '../../common/dto/pagination-query.dto';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer) private readonly customers: Repository<Customer>,
    @InjectRepository(Address) private readonly addresses: Repository<Address>,
  ) {}

  async createForUser(user: User, phone?: string): Promise<Customer> {
    const customer = this.customers.create({ userId: user.id, phone: phone ?? null });
    return this.customers.save(customer);
  }

  async findByUserId(userId: string): Promise<Customer> {
    const customer = await this.customers.findOne({
      where: { userId },
      relations: { addresses: true, user: true },
    });
    if (!customer) {
      throw new NotFoundException('Customer profile not found');
    }
    return customer;
  }

  async findById(id: string): Promise<Customer> {
    const customer = await this.customers.findOne({
      where: { id },
      relations: { addresses: true, user: true },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    return customer;
  }

  async list(query: PaginationQueryDto) {
    const [items, total] = await this.customers.findAndCount({
      skip: query.skip,
      take: query.limit,
      relations: { user: true },
      order: { createdAt: 'DESC' },
    });
    return paginate(items, total, query.page, query.limit);
  }

  async updateMine(userId: string, dto: UpdateCustomerDto): Promise<Customer> {
    const customer = await this.findByUserId(userId);
    if (dto.phone !== undefined) customer.phone = dto.phone;
    if (dto.dateOfBirth !== undefined) customer.dateOfBirth = dto.dateOfBirth;
    return this.customers.save(customer);
  }

  async addAddress(userId: string, dto: CreateAddressDto): Promise<Address> {
    const customer = await this.findByUserId(userId);
    if (dto.isDefault) {
      await this.addresses.update({ customerId: customer.id }, { isDefault: false });
    }
    const address = this.addresses.create({ ...dto, customerId: customer.id, line2: dto.line2 ?? null, state: dto.state ?? null });
    return this.addresses.save(address);
  }

  async listAddresses(userId: string): Promise<Address[]> {
    const customer = await this.findByUserId(userId);
    return this.addresses.find({ where: { customerId: customer.id }, order: { isDefault: 'DESC' } });
  }

  async removeAddress(userId: string, addressId: string): Promise<void> {
    const customer = await this.findByUserId(userId);
    const address = await this.addresses.findOne({ where: { id: addressId, customerId: customer.id } });
    if (!address) {
      throw new NotFoundException('Address not found');
    }
    await this.addresses.remove(address);
  }
}
