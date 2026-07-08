import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { AppException } from '../../common/exceptions/app.exception';
import { MailService } from '../../lib/mail/mail.service';
import { PrismaService } from '../../lib/database/prisma.service';
import { AuthService } from './auth.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue('hashed-value'),
}));

const mockedBcrypt = bcrypt as unknown as {
  compare: jest.Mock;
  hash: jest.Mock;
};

const CONFIG_VALUES: Record<string, string> = {
  JWT_ACCESS_SECRET: 'access-secret',
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_SECRET: 'refresh-secret',
  JWT_REFRESH_EXPIRES_IN: '7d',
};

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    companyUser: { findUnique: jest.Mock; update: jest.Mock };
    staffUser: { findUnique: jest.Mock; update: jest.Mock };
    refreshToken: {
      findUnique: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
      updateMany: jest.Mock;
    };
    platformSettings: { findUnique: jest.Mock };
  };
  let jwtService: { sign: jest.Mock; verify: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    prisma = {
      companyUser: { findUnique: jest.fn(), update: jest.fn() },
      staffUser: { findUnique: jest.fn(), update: jest.fn() },
      refreshToken: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
      platformSettings: { findUnique: jest.fn() },
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('signed.jwt.token'),
      verify: jest.fn(),
    };

    const configService = {
      get: jest.fn((key: string) => CONFIG_VALUES[key]),
    } as unknown as ConfigService;

    const mailService = {
      sendPasswordResetEmail: jest.fn(),
      sendVerificationEmail: jest.fn(),
    } as unknown as MailService;

    service = new AuthService(
      jwtService as unknown as JwtService,
      mailService,
      prisma as unknown as PrismaService,
      configService,
    );
  });

  describe('login lockout', () => {
    const baseCompanyUser = {
      id: 'company-user-1',
      email: 'owner@company.com',
      password: 'hashed-password',
      companyId: 'company-1',
      failedAttempts: 0,
      lockedUntil: null,
      mustChangePassword: false,
    };

    it('increments failedAttempts on a wrong password without locking below threshold', async () => {
      prisma.companyUser.findUnique.mockResolvedValue({
        ...baseCompanyUser,
        failedAttempts: 2,
      });
      prisma.platformSettings.findUnique.mockResolvedValue(null); // falls back to default threshold (5)
      mockedBcrypt.compare.mockResolvedValue(false);

      await expect(
        service.login({ email: baseCompanyUser.email, password: 'wrong' }),
      ).rejects.toThrow(AppException);

      expect(prisma.companyUser.update).toHaveBeenCalledWith({
        where: { id: baseCompanyUser.id },
        data: { failedAttempts: 3, lockedUntil: null },
      });
    });

    it('locks the account once failedAttempts reaches the threshold', async () => {
      prisma.companyUser.findUnique.mockResolvedValue({
        ...baseCompanyUser,
        failedAttempts: 4,
      });
      prisma.platformSettings.findUnique.mockResolvedValue({
        loginLockoutThreshold: 5,
        loginLockoutDurationMinutes: 30,
      });
      mockedBcrypt.compare.mockResolvedValue(false);

      const before = Date.now();
      await expect(
        service.login({ email: baseCompanyUser.email, password: 'wrong' }),
      ).rejects.toThrow(AppException);

      expect(prisma.companyUser.update).toHaveBeenCalledTimes(1);
      const calls = prisma.companyUser.update.mock.calls as unknown as Array<
        [
          {
            where: { id: string };
            data: { failedAttempts: number; lockedUntil: Date };
          },
        ]
      >;
      const call = calls[0][0];
      expect(call.where).toEqual({ id: baseCompanyUser.id });
      expect(call.data.failedAttempts).toBe(5);
      expect(call.data.lockedUntil).toBeInstanceOf(Date);
      expect(call.data.lockedUntil.getTime()).toBeGreaterThanOrEqual(
        before + 30 * 60_000 - 1000,
      );
    });

    it('rejects with 423 locked while lockedUntil is in the future, without checking the password', async () => {
      prisma.companyUser.findUnique.mockResolvedValue({
        ...baseCompanyUser,
        lockedUntil: new Date(Date.now() + 10 * 60_000),
      });

      let thrown: unknown;
      try {
        await service.login({
          email: baseCompanyUser.email,
          password: 'whatever',
        });
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(AppException);
      expect((thrown as AppException).getStatus()).toBe(423);
      expect((thrown as AppException).getResponse()).toMatchObject({
        code: 'locked',
      });

      expect(mockedBcrypt.compare).not.toHaveBeenCalled();
    });

    it('resets failedAttempts and lockedUntil on a successful login', async () => {
      prisma.companyUser.findUnique.mockResolvedValue({
        ...baseCompanyUser,
        failedAttempts: 3,
      });
      mockedBcrypt.compare.mockResolvedValue(true);
      prisma.refreshToken.create.mockResolvedValue({ id: 'refresh-1' });

      await service.login({
        email: baseCompanyUser.email,
        password: 'correct',
      });

      expect(prisma.companyUser.update).toHaveBeenCalledWith({
        where: { id: baseCompanyUser.id },
        data: {
          failedAttempts: 0,
          lockedUntil: null,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- expect.any() is typed `any` by @types/jest
          lastLoginAt: expect.any(Date),
        },
      });
    });
  });

  describe('refresh rotation', () => {
    it('revokes the old refresh token and issues a new pair', async () => {
      const tokenRow = {
        id: 'refresh-row-1',
        hashedToken: 'hashed-secret',
        expiresAt: new Date(Date.now() + 60_000),
        revoked: false,
        companyUserId: 'company-user-1',
        staffUserId: null,
      };
      prisma.refreshToken.findUnique.mockResolvedValue(tokenRow);
      mockedBcrypt.compare.mockResolvedValue(true);
      prisma.companyUser.findUnique.mockResolvedValue({
        id: 'company-user-1',
        companyId: 'company-1',
        isActive: true,
      });
      prisma.refreshToken.create.mockResolvedValue({ id: 'refresh-row-2' });

      await service.refresh({
        sub: 'company-user-1',
        userType: 'COMPANY',
        jti: tokenRow.id,
        secret: 'plain-secret',
      });

      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: tokenRow.id },
        data: { revoked: true },
      });
      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
    });

    it('revokes all sessions and rejects when an already-revoked token is replayed', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        id: 'refresh-row-1',
        hashedToken: 'hashed-secret',
        expiresAt: new Date(Date.now() + 60_000),
        revoked: true,
        companyUserId: 'company-user-1',
        staffUserId: null,
      });

      await expect(
        service.refresh({
          sub: 'company-user-1',
          userType: 'COMPANY',
          jti: 'refresh-row-1',
          secret: 'plain-secret',
        }),
      ).rejects.toThrow(AppException);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { companyUserId: 'company-user-1', revoked: false },
        data: { revoked: true },
      });
    });
  });

  describe('activate', () => {
    it('rejects an expired activation token', async () => {
      const token = 'raw-activation-token';
      const tokenHash = createHash('sha256').update(token).digest('hex');
      prisma.companyUser.findUnique.mockResolvedValue({
        id: 'company-user-1',
        activationToken: tokenHash,
        activationExpires: new Date(Date.now() - 60_000), // expired
      });

      let thrown: unknown;
      try {
        await service.activate({ token, newPassword: 'newpassword123' });
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(AppException);
      expect((thrown as AppException).getStatus()).toBe(400);
      expect((thrown as AppException).getResponse()).toMatchObject({
        code: 'invalid_request',
      });

      expect(prisma.companyUser.findUnique).toHaveBeenCalledWith({
        where: { activationToken: tokenHash },
      });
      expect(prisma.companyUser.update).not.toHaveBeenCalled();
    });

    it('rejects a used (cleared) activation token', async () => {
      prisma.companyUser.findUnique.mockResolvedValue(null);

      await expect(
        service.activate({
          token: 'already-used-token',
          newPassword: 'newpassword123',
        }),
      ).rejects.toThrow(AppException);
    });

    it('activates the account and clears the token when valid', async () => {
      const token = 'raw-activation-token';
      const tokenHash = createHash('sha256').update(token).digest('hex');
      prisma.companyUser.findUnique.mockResolvedValue({
        id: 'company-user-1',
        activationToken: tokenHash,
        activationExpires: new Date(Date.now() + 60_000),
      });

      await service.activate({ token, newPassword: 'newpassword123' });

      expect(prisma.companyUser.update).toHaveBeenCalledWith({
        where: { id: 'company-user-1' },
        data: {
          password: 'hashed-value',
          activationToken: null,
          activationExpires: null,
          mustChangePassword: false,
          isActive: true,
          failedAttempts: 0,
          lockedUntil: null,
        },
      });
    });
  });
});
