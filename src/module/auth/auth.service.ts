import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { CompanyUser, StaffUser } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes, randomInt } from 'crypto';
import { PrismaService } from '../../lib/database/prisma.service';
import { MailService } from '../../lib/mail/mail.service';
import { AppException } from '../../common/exceptions/app.exception';
import {
  RequestUser,
  UserType,
} from '../../common/types/request-user.interface';
import { ActivateDto } from './dto/activate.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import {
  AccessTokenPayload,
  RefreshTokenPayload,
} from './types/jwt-payload.interface';

const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;
const DEFAULT_LOCKOUT_THRESHOLD = 5;
const DEFAULT_LOCKOUT_DURATION_MINUTES = 30;
const GENERIC_MESSAGE = {
  message: 'If that account exists, an email was sent.',
};

export interface TokenPair {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

interface TokenClaims {
  sub: string;
  userType: UserType;
  companyId?: string;
  role?: AccessTokenPayload['role'];
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async login(
    dto: LoginDto,
  ): Promise<TokenPair & { userType: UserType; mustChangePassword?: boolean }> {
    const companyUser = await this.prisma.companyUser.findUnique({
      where: { email: dto.email },
    });

    if (companyUser) {
      return this.loginCompanyUser(companyUser, dto.password);
    }

    const staffUser = await this.prisma.staffUser.findUnique({
      where: { email: dto.email },
    });

    if (staffUser) {
      return this.loginStaffUser(staffUser, dto.password);
    }

    throw new AppException(401, 'unauthorized', 'Invalid credentials');
  }

  private async loginCompanyUser(
    companyUser: CompanyUser,
    password: string,
  ): Promise<TokenPair & { userType: UserType; mustChangePassword: boolean }> {
    if (companyUser.lockedUntil && companyUser.lockedUntil > new Date()) {
      throw new AppException(423, 'locked', 'Account locked, try again later');
    }

    const passwordMatches = await bcrypt.compare(
      password,
      companyUser.password,
    );
    if (!passwordMatches) {
      await this.registerFailedAttempt(companyUser);
      throw new AppException(401, 'unauthorized', 'Invalid credentials');
    }

    await this.prisma.companyUser.update({
      where: { id: companyUser.id },
      data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });

    const tokens = await this.issueTokenPair({
      sub: companyUser.id,
      userType: 'COMPANY',
      companyId: companyUser.companyId,
    });

    return {
      ...tokens,
      userType: 'COMPANY',
      mustChangePassword: companyUser.mustChangePassword,
    };
  }

  private async loginStaffUser(
    staffUser: StaffUser,
    password: string,
  ): Promise<TokenPair & { userType: UserType }> {
    if (!staffUser.isActive) {
      throw new AppException(401, 'unauthorized', 'Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(password, staffUser.password);
    if (!passwordMatches) {
      throw new AppException(401, 'unauthorized', 'Invalid credentials');
    }

    const tokens = await this.issueTokenPair({
      sub: staffUser.id,
      userType: 'STAFF',
      role: staffUser.role,
    });

    return { ...tokens, userType: 'STAFF' };
  }

  private async registerFailedAttempt(companyUser: CompanyUser): Promise<void> {
    const settings = await this.prisma.platformSettings.findUnique({
      where: { id: 1 },
    });
    const threshold =
      settings?.loginLockoutThreshold ?? DEFAULT_LOCKOUT_THRESHOLD;
    const durationMinutes =
      settings?.loginLockoutDurationMinutes ?? DEFAULT_LOCKOUT_DURATION_MINUTES;

    const failedAttempts = companyUser.failedAttempts + 1;
    const lockedUntil =
      failedAttempts >= threshold
        ? new Date(Date.now() + durationMinutes * 60_000)
        : null;

    await this.prisma.companyUser.update({
      where: { id: companyUser.id },
      data: { failedAttempts, lockedUntil },
    });
  }

  async refresh(
    payload: RefreshTokenPayload,
  ): Promise<TokenPair & { userType: UserType }> {
    const tokenRow = await this.prisma.refreshToken.findUnique({
      where: { id: payload.jti },
    });

    if (!tokenRow) {
      throw new AppException(401, 'unauthorized', 'Invalid refresh token');
    }

    const ownerId =
      payload.userType === 'COMPANY'
        ? tokenRow.companyUserId
        : tokenRow.staffUserId;
    const otherId =
      payload.userType === 'COMPANY'
        ? tokenRow.staffUserId
        : tokenRow.companyUserId;

    if (ownerId !== payload.sub || otherId !== null) {
      throw new AppException(401, 'unauthorized', 'Invalid refresh token');
    }

    if (tokenRow.revoked) {
      await this.revokeAllForUser(payload.userType, payload.sub);
      throw new AppException(
        401,
        'unauthorized',
        'Session revoked, please log in again',
      );
    }

    if (tokenRow.expiresAt < new Date()) {
      throw new AppException(401, 'unauthorized', 'Session expired');
    }

    const matches = await bcrypt.compare(payload.secret, tokenRow.hashedToken);
    if (!matches) {
      throw new AppException(401, 'unauthorized', 'Invalid refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: tokenRow.id },
      data: { revoked: true },
    });

    if (payload.userType === 'COMPANY') {
      const companyUser = await this.prisma.companyUser.findUnique({
        where: { id: payload.sub },
      });
      if (!companyUser || !companyUser.isActive) {
        throw new AppException(401, 'unauthorized', 'Invalid refresh token');
      }
      const tokens = await this.issueTokenPair({
        sub: companyUser.id,
        userType: 'COMPANY',
        companyId: companyUser.companyId,
      });
      return { ...tokens, userType: 'COMPANY' };
    }

    const staffUser = await this.prisma.staffUser.findUnique({
      where: { id: payload.sub },
    });
    if (!staffUser || !staffUser.isActive) {
      throw new AppException(401, 'unauthorized', 'Invalid refresh token');
    }
    const tokens = await this.issueTokenPair({
      sub: staffUser.id,
      userType: 'STAFF',
      role: staffUser.role,
    });
    return { ...tokens, userType: 'STAFF' };
  }

  async logout(refreshToken: string): Promise<{ message: string }> {
    try {
      const payload = this.jwtService.verify<RefreshTokenPayload>(
        refreshToken,
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        },
      );
      await this.prisma.refreshToken.updateMany({
        where: { id: payload.jti },
        data: { revoked: true },
      });
    } catch {
      // Already invalid/expired - treat as already logged out.
    }
    return { message: 'Logged out' };
  }

  async logoutAll(user: RequestUser): Promise<{ message: string }> {
    await this.revokeAllForUser(user.userType, user.userId);
    return { message: 'All sessions revoked' };
  }

  async changePassword(
    user: RequestUser,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    if (user.userType === 'COMPANY') {
      const companyUser = await this.prisma.companyUser.findUnique({
        where: { id: user.userId },
      });
      if (!companyUser) {
        throw new AppException(401, 'unauthorized', 'Invalid session');
      }
      const matches = await bcrypt.compare(
        dto.currentPassword,
        companyUser.password,
      );
      if (!matches) {
        throw new AppException(401, 'unauthorized', 'Invalid credentials');
      }
      const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
      await this.prisma.companyUser.update({
        where: { id: companyUser.id },
        data: { password: hashedPassword, mustChangePassword: false },
      });
      return { message: 'Password changed successfully' };
    }

    const staffUser = await this.prisma.staffUser.findUnique({
      where: { id: user.userId },
    });
    if (!staffUser) {
      throw new AppException(401, 'unauthorized', 'Invalid session');
    }
    const matches = await bcrypt.compare(
      dto.currentPassword,
      staffUser.password,
    );
    if (!matches) {
      throw new AppException(401, 'unauthorized', 'Invalid credentials');
    }
    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.staffUser.update({
      where: { id: staffUser.id },
      data: { password: hashedPassword },
    });
    return { message: 'Password changed successfully' };
  }

  async activate(dto: ActivateDto): Promise<{ message: string }> {
    const tokenHash = createHash('sha256').update(dto.token).digest('hex');
    const companyUser = await this.prisma.companyUser.findUnique({
      where: { activationToken: tokenHash },
    });

    if (
      !companyUser ||
      !companyUser.activationExpires ||
      companyUser.activationExpires < new Date()
    ) {
      throw new AppException(
        400,
        'invalid_request',
        'Invalid or expired activation token',
      );
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.companyUser.update({
      where: { id: companyUser.id },
      data: {
        password: hashedPassword,
        activationToken: null,
        activationExpires: null,
        mustChangePassword: false,
        isActive: true,
        failedAttempts: 0,
        lockedUntil: null,
      },
    });

    return { message: 'Account activated' };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const companyUser = await this.prisma.companyUser.findUnique({
      where: { email: dto.email },
    });
    if (companyUser) {
      const code = this.generateOtp();
      const expires = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
      await this.prisma.companyUser.update({
        where: { id: companyUser.id },
        data: { passwordResetCode: code, passwordResetExpires: expires },
      });
      await this.mailService.sendPasswordResetEmail(companyUser.email, code);
      return GENERIC_MESSAGE;
    }

    const staffUser = await this.prisma.staffUser.findUnique({
      where: { email: dto.email },
    });
    if (staffUser) {
      const code = this.generateOtp();
      const expires = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
      await this.prisma.staffUser.update({
        where: { id: staffUser.id },
        data: { passwordResetCode: code, passwordResetExpires: expires },
      });
      await this.mailService.sendPasswordResetEmail(staffUser.email, code);
    }

    return GENERIC_MESSAGE;
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const companyUser = await this.prisma.companyUser.findUnique({
      where: { email: dto.email },
    });
    if (companyUser && this.isResetCodeValid(companyUser, dto.code)) {
      const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
      await this.prisma.companyUser.update({
        where: { id: companyUser.id },
        data: {
          password: hashedPassword,
          passwordResetCode: null,
          passwordResetExpires: null,
          failedAttempts: 0,
          lockedUntil: null,
        },
      });
      await this.revokeAllForUser('COMPANY', companyUser.id);
      return { message: 'Password reset successfully' };
    }

    const staffUser = await this.prisma.staffUser.findUnique({
      where: { email: dto.email },
    });
    if (staffUser && this.isResetCodeValid(staffUser, dto.code)) {
      const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
      await this.prisma.staffUser.update({
        where: { id: staffUser.id },
        data: {
          password: hashedPassword,
          passwordResetCode: null,
          passwordResetExpires: null,
        },
      });
      await this.revokeAllForUser('STAFF', staffUser.id);
      return { message: 'Password reset successfully' };
    }

    throw new AppException(400, 'invalid_request', 'Invalid or expired code');
  }

  private isResetCodeValid(
    user: {
      passwordResetCode: string | null;
      passwordResetExpires: Date | null;
    },
    code: string,
  ): boolean {
    return (
      !!user.passwordResetCode &&
      !!user.passwordResetExpires &&
      user.passwordResetExpires > new Date() &&
      user.passwordResetCode === code
    );
  }

  private async revokeAllForUser(
    userType: UserType,
    id: string,
  ): Promise<void> {
    const where =
      userType === 'COMPANY'
        ? { companyUserId: id, revoked: false }
        : { staffUserId: id, revoked: false };
    await this.prisma.refreshToken.updateMany({
      where,
      data: { revoked: true },
    });
  }

  private generateOtp(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private async issueTokenPair(claims: TokenClaims): Promise<TokenPair> {
    const secret = randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(secret, 10);
    const refreshExpiresInMs = this.parseExpiresInMs(
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN')!,
    );
    const accessExpiresInMs = this.parseExpiresInMs(
      this.configService.get<string>('JWT_ACCESS_EXPIRES_IN')!,
    );
    const now = Date.now();
    const accessTokenExpiresAt = new Date(now + accessExpiresInMs);
    const refreshTokenExpiresAt = new Date(now + refreshExpiresInMs);

    const tokenRow = await this.prisma.refreshToken.create({
      data: {
        hashedToken,
        expiresAt: refreshTokenExpiresAt,
        companyUserId: claims.userType === 'COMPANY' ? claims.sub : undefined,
        staffUserId: claims.userType === 'STAFF' ? claims.sub : undefined,
      },
    });

    const accessPayload: AccessTokenPayload = {
      sub: claims.sub,
      userType: claims.userType,
      ...(claims.companyId ? { companyId: claims.companyId } : {}),
      ...(claims.role ? { role: claims.role } : {}),
    };

    const accessToken = this.jwtService.sign(accessPayload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: Math.floor(accessExpiresInMs / 1000),
    });

    const refreshPayload: RefreshTokenPayload = {
      sub: claims.sub,
      userType: claims.userType,
      jti: tokenRow.id,
      secret,
    };

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: Math.floor(refreshExpiresInMs / 1000),
    });

    return {
      accessToken,
      accessTokenExpiresAt: accessTokenExpiresAt.toISOString(),
      refreshToken,
      refreshTokenExpiresAt: refreshTokenExpiresAt.toISOString(),
    };
  }

  private parseExpiresInMs(value: string): number {
    const match = /^(\d+)([smhd])$/.exec(value);
    if (!match) return Number(value) || 0;
    const amount = Number(match[1]);
    const unit = match[2];
    const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit]!;
    return amount * unitMs;
  }
}
