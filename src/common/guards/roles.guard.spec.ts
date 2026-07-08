import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { StaffRole } from '@prisma/client';
import { AppException } from '../exceptions/app.exception';
import { RequestUser } from '../types/request-user.interface';
import { RolesGuard } from './roles.guard';

function createContext(user?: RequestUser): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('rejects a CLOSER on a route requiring OPERATIONS', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([StaffRole.OPERATIONS]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const context = createContext({
      userId: 'staff-1',
      userType: 'STAFF',
      role: StaffRole.CLOSER,
    });

    expect(() => guard.canActivate(context)).toThrow(AppException);
  });

  it('lets ADMIN pass a route requiring OPERATIONS', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([StaffRole.OPERATIONS]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const context = createContext({
      userId: 'staff-1',
      userType: 'STAFF',
      role: StaffRole.ADMIN,
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('lets OPERATIONS pass a route requiring OPERATIONS', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([StaffRole.OPERATIONS]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const context = createContext({
      userId: 'staff-1',
      userType: 'STAFF',
      role: StaffRole.OPERATIONS,
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects a COMPANY token even if no role requirement matches by accident', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([StaffRole.OPERATIONS]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const context = createContext({
      userId: 'company-user-1',
      userType: 'COMPANY',
      companyId: 'company-1',
    });

    expect(() => guard.canActivate(context)).toThrow(AppException);
  });
});
