import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppException } from '../exceptions/app.exception';
import { PrismaService } from '../../lib/database/prisma.service';
import { RequestUser } from '../types/request-user.interface';
import { ALLOW_MUST_CHANGE_PASSWORD_KEY } from '../decorators/allow-must-change-password.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { MustChangePasswordGuard } from './must-change-password.guard';

function createContext(user?: RequestUser): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function createReflector(metadata: Record<string, boolean>): Reflector {
  return {
    getAllAndOverride: jest.fn((key: string) => metadata[key] ?? false),
  } as unknown as Reflector;
}

describe('MustChangePasswordGuard', () => {
  it('blocks a CompanyUser with mustChangePassword=true from other routes', async () => {
    const reflector = createReflector({
      [IS_PUBLIC_KEY]: false,
      [ALLOW_MUST_CHANGE_PASSWORD_KEY]: false,
    });
    const prisma = {
      companyUser: {
        findUnique: jest.fn().mockResolvedValue({ mustChangePassword: true }),
      },
    } as unknown as PrismaService;
    const guard = new MustChangePasswordGuard(reflector, prisma);
    const context = createContext({
      userId: 'company-user-1',
      userType: 'COMPANY',
      companyId: 'company-1',
    });

    await expect(guard.canActivate(context)).rejects.toThrow(AppException);
  });

  it('allows the change-password route itself even when mustChangePassword=true', async () => {
    const reflector = createReflector({
      [IS_PUBLIC_KEY]: false,
      [ALLOW_MUST_CHANGE_PASSWORD_KEY]: true,
    });
    const prisma = {
      companyUser: {
        findUnique: jest.fn().mockResolvedValue({ mustChangePassword: true }),
      },
    } as unknown as PrismaService;
    const guard = new MustChangePasswordGuard(reflector, prisma);
    const context = createContext({
      userId: 'company-user-1',
      userType: 'COMPANY',
      companyId: 'company-1',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('lets the request through once mustChangePassword is false', async () => {
    const reflector = createReflector({
      [IS_PUBLIC_KEY]: false,
      [ALLOW_MUST_CHANGE_PASSWORD_KEY]: false,
    });
    const prisma = {
      companyUser: {
        findUnique: jest.fn().mockResolvedValue({ mustChangePassword: false }),
      },
    } as unknown as PrismaService;
    const guard = new MustChangePasswordGuard(reflector, prisma);
    const context = createContext({
      userId: 'company-user-1',
      userType: 'COMPANY',
      companyId: 'company-1',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('does not look up STAFF users (mustChangePassword only applies to CompanyUser)', async () => {
    const reflector = createReflector({
      [IS_PUBLIC_KEY]: false,
      [ALLOW_MUST_CHANGE_PASSWORD_KEY]: false,
    });
    const findUnique = jest.fn();
    const prisma = { companyUser: { findUnique } } as unknown as PrismaService;
    const guard = new MustChangePasswordGuard(reflector, prisma);
    const context = createContext({
      userId: 'staff-1',
      userType: 'STAFF',
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(findUnique).not.toHaveBeenCalled();
  });
});
