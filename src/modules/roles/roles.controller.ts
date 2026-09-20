import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PermissionSlug } from '../../common/constants/permissions.constant';

@ApiTags('roles')
@ApiBearerAuth('access-token')
@Controller('roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @RequirePermissions(PermissionSlug.ROLES_READ)
  findAll() {
    return this.roles.findAll();
  }

  @Get('permissions')
  @RequirePermissions(PermissionSlug.ROLES_READ)
  listPermissions() {
    return this.roles.listPermissions();
  }

  @Post()
  @RequirePermissions(PermissionSlug.ROLES_WRITE)
  create(@Body() dto: CreateRoleDto) {
    return this.roles.create(dto);
  }

  @Patch(':id/permissions')
  @RequirePermissions(PermissionSlug.ROLES_WRITE)
  assign(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignPermissionsDto) {
    return this.roles.assignPermissions(id, dto);
  }
}
