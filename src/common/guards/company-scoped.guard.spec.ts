import { ExecutionContext } from '@nestjs/common';
import { StaffRole } from '@prisma/client';
import { AppException } from '../exceptions/app.exception';
import { RequestUser } from '../types/request-user.interface';
import { CompanyScopedGuard } from './company-scoped.guard';

function createContext(user?: RequestUser): {
  context: ExecutionContext;
  request: { user?: RequestUser; companyId?: string };
} {
  const request: { user?: RequestUser; companyId?: string } = { user };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('CompanyScopedGuard', () => {
  const guard = new CompanyScopedGuard();

  it('rejects a STAFF token', () => {
    const { context } = createContext({
      userId: 'staff-1',
      userType: 'STAFF',
      role: StaffRole.ADMIN,
    });

    expect(() => guard.canActivate(context)).toThrow(AppException);
  });

  it('rejects when there is no companyId on the token', () => {
    const { context } = createContext({
      userId: 'company-user-1',
      userType: 'COMPANY',
    });

    expect(() => guard.canActivate(context)).toThrow(AppException);
  });

  it('passes a COMPANY token and injects companyId onto the request', () => {
    const { context, request } = createContext({
      userId: 'company-user-1',
      userType: 'COMPANY',
      companyId: 'company-1',
    });

    expect(guard.canActivate(context)).toBe(true);
    expect(request.companyId).toBe('company-1');
  });
});
