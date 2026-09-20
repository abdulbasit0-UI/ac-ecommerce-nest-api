import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Customer } from './entities/customer.entity';
import { Address } from './entities/address.entity';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Customer, Address])],
  providers: [CustomersService],
  controllers: [CustomersController],
  exports: [CustomersService, TypeOrmModule],
})
export class CustomersModule {}
