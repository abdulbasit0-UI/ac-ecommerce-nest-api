import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PermissionSlug } from '../../common/constants/permissions.constant';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from './entities/user.entity';

@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  me(@CurrentUser() user: User) {
    return user;
  }

  @Get()
  @RequirePermissions(PermissionSlug.USERS_READ)
  list(@Query() query: PaginationQueryDto) {
    return this.users.list(query);
  }

  @Get(':id')
  @RequirePermissions(PermissionSlug.USERS_READ)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.findById(id);
  }

  @Patch(':id')
  @RequirePermissions(PermissionSlug.USERS_WRITE)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PermissionSlug.USERS_WRITE)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.remove(id);
  }
}
