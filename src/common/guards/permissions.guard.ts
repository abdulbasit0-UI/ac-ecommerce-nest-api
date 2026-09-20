import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionSlug } from '../constants/permissions.constant';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { RoleName } from '../constants/roles.constant';
import { User } from '../../modules/users/entities/user.entity';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<PermissionSlug[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) {
      return true;
    }

    const user = context.switchToHttp().getRequest<{ user: User }>().user;
    if (user?.role?.name === RoleName.SUPER_ADMIN) {
      return true;
    }

    const owned = new Set(user?.role?.permissions?.map((permission) => permission.slug) ?? []);
    const allowed = required.every((slug) => owned.has(slug));
    if (!allowed) {
      throw new ForbiddenException('Missing required permission');
    }
    return true;
  }
}
