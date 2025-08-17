import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ROLES_KEY, Role } from '../../auth/decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  @Inject(Reflector) private readonly reflector: Reflector;

  public canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!roles || roles.length === 0) return true;
    const req = context.switchToHttp().getRequest();
    const user = req.user as { role?: Role };
    if (!user || !user.role) throw new ForbiddenException('No role');
    if (!roles.includes(user.role)) throw new ForbiddenException('Insufficient role');
    return true;
  }
}
