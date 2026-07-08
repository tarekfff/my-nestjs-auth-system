import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { StaffRole } from '@prisma/client';
import { AppException } from '../exceptions/app.exception';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RequestUser } from '../types/request-user.interface';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<StaffRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = request.user;

    if (!user || user.userType !== 'STAFF' || !user.role) {
      throw new AppException(403, 'forbidden', 'Forbidden');
    }

    if (user.role === StaffRole.ADMIN) {
      return true;
    }

    if (!requiredRoles.includes(user.role)) {
      throw new AppException(403, 'forbidden', 'Forbidden');
    }

    return true;
  }
}
