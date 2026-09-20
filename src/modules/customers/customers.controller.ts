import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PermissionSlug } from '../../common/constants/permissions.constant';

@ApiTags('customers')
@ApiBearerAuth('access-token')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get('me')
  me(@CurrentUser() user: User) {
    return this.customers.findByUserId(user.id);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: User, @Body() dto: UpdateCustomerDto) {
    return this.customers.updateMine(user.id, dto);
  }

  @Get('me/addresses')
  myAddresses(@CurrentUser() user: User) {
    return this.customers.listAddresses(user.id);
  }

  @Post('me/addresses')
  addAddress(@CurrentUser() user: User, @Body() dto: CreateAddressDto) {
    return this.customers.addAddress(user.id, dto);
  }

  @Delete('me/addresses/:addressId')
  removeAddress(
    @CurrentUser() user: User,
    @Param('addressId', ParseUUIDPipe) addressId: string,
  ) {
    return this.customers.removeAddress(user.id, addressId);
  }

  @Get()
  @RequirePermissions(PermissionSlug.CUSTOMERS_READ)
  list(@Query() query: PaginationQueryDto) {
    return this.customers.list(query);
  }

  @Get(':id')
  @RequirePermissions(PermissionSlug.CUSTOMERS_READ)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.customers.findById(id);
  }
}
