import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleName } from '../constants/roles.constant';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { User } from '../../modules/users/entities/user.entity';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RoleName[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) {
      return true;
    }

    const user = context.switchToHttp().getRequest<{ user: User }>().user;
    const roleName = user?.role?.name;
    if (!roleName || !required.includes(roleName as RoleName)) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}
