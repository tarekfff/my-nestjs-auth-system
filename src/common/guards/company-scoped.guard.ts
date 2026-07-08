import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AppException } from '../exceptions/app.exception';
import { RequestUser } from '../types/request-user.interface';

@Injectable()
export class CompanyScopedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<{ user?: RequestUser; companyId?: string }>();
    const user = request.user;

    if (!user || user.userType !== 'COMPANY' || !user.companyId) {
      throw new AppException(403, 'forbidden', 'Forbidden');
    }

    request.companyId = user.companyId;
    return true;
  }
}
