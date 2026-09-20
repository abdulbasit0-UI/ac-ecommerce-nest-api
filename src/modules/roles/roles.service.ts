import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { RoleName } from '../../common/constants/roles.constant';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role) private readonly roles: Repository<Role>,
    @InjectRepository(Permission) private readonly permissions: Repository<Permission>,
  ) {}

  findAll() {
    return this.roles.find({ relations: { permissions: true } });
  }

  async findByName(name: RoleName): Promise<Role> {
    const role = await this.roles.findOne({ where: { name }, relations: { permissions: true } });
    if (!role) {
      throw new NotFoundException(`Role ${name} not found`);
    }
    return role;
  }

  async findById(id: string): Promise<Role> {
    const role = await this.roles.findOne({ where: { id }, relations: { permissions: true } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return role;
  }

  listPermissions() {
    return this.permissions.find({ order: { slug: 'ASC' } });
  }

  async create(dto: CreateRoleDto): Promise<Role> {
    const permissions = dto.permissionSlugs?.length
      ? await this.permissions.find({ where: { slug: In(dto.permissionSlugs) } })
      : [];
    const role = this.roles.create({
      name: dto.name as RoleName,
      description: dto.description ?? null,
      permissions,
    });
    return this.roles.save(role);
  }

  async assignPermissions(id: string, dto: AssignPermissionsDto): Promise<Role> {
    const role = await this.findById(id);
    role.permissions = await this.permissions.find({ where: { slug: In(dto.permissionSlugs) } });
    return this.roles.save(role);
  }
}
