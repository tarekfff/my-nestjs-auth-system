import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../lib/database/prisma.service';
import { MailService } from '../../lib/mail/mail.service';
import { UserService } from '../user/user.service';
import { UserEntity } from '../user/entities/user.entity';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RefreshTokenPayload } from './types/jwt-payload.interface';

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const GENERIC_MESSAGE = {
  message: 'If that account exists, an email was sent.',
};

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<UserEntity> {
    const existing = await this.userService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const emailVerificationToken = randomBytes(32).toString('hex');
    const emailVerificationExpires = new Date(
      Date.now() + EMAIL_VERIFICATION_TTL_MS,
    );

    const user = await this.userService.create({
      name: dto.name,
      email: dto.email,
      password: hashedPassword,
      emailVerificationToken,
      emailVerificationExpires,
    });

    await this.mailService.sendVerificationEmail(
      user.email,
      emailVerificationToken,
    );

    return new UserEntity(user);
  }

  async login(dto: LoginDto): Promise<TokenPair & { user: UserEntity }> {
    const user = await this.userService.findByEmail(dto.email);
    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isEmailVerified) {
      throw new ForbiddenException('Email not verified');
    }

    const tokens = await this.issueTokenPair(user);
    return { ...tokens, user: new UserEntity(user) };
  }

  async refresh(payload: RefreshTokenPayload): Promise<TokenPair> {
    const tokenRow = await this.prisma.refreshToken.findUnique({
      where: { id: payload.jti },
    });

    if (!tokenRow || tokenRow.userId !== payload.sub) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (tokenRow.revoked) {
      await this.logoutAll(tokenRow.userId);
      throw new UnauthorizedException('Session revoked, please log in again');
    }

    if (tokenRow.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired');
    }

    const matches = await bcrypt.compare(payload.secret, tokenRow.hashedToken);
    if (!matches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.userService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: tokenRow.id },
      data: { revoked: true },
    });

    return this.issueTokenPair(user);
  }

  async logout(refreshToken: string): Promise<{ message: string }> {
    try {
      const payload = this.jwtService.verify<RefreshTokenPayload>(
        refreshToken,
        { secret: this.configService.get<string>('JWT_REFRESH_SECRET') },
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

  async logoutAll(userId: string): Promise<{ message: string }> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });
    return { message: 'All sessions revoked' };
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const user = await this.userService.findByEmailVerificationToken(token);
    if (!user) {
      throw new BadRequestException('Invalid or expired token');
    }
    await this.userService.updateEmailVerification(user.id);
    return { message: 'Email verified' };
  }

  async resendVerification(
    dto: ResendVerificationDto,
  ): Promise<{ message: string }> {
    const user = await this.userService.findByEmail(dto.email);
    if (user && !user.isEmailVerified) {
      const token = randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);
      await this.userService.setEmailVerificationToken(user.id, token, expires);
      await this.mailService.sendVerificationEmail(user.email, token);
    }
    return GENERIC_MESSAGE;
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.userService.findByEmail(dto.email);
    if (user) {
      const token = randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
      await this.userService.setPasswordResetToken(user.id, token, expires);
      await this.mailService.sendPasswordResetEmail(user.email, token);
    }
    return GENERIC_MESSAGE;
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const user = await this.userService.findByPasswordResetToken(dto.token);
    if (!user) {
      throw new BadRequestException('Invalid or expired token');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
    await this.userService.updatePassword(user.id, hashedPassword);
    await this.logoutAll(user.id);

    return { message: 'Password reset successfully' };
  }

  private async issueTokenPair(user: User): Promise<TokenPair> {
    const secret = randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(secret, 10);
    const refreshExpiresInMs = this.parseExpiresInMs(
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN')!,
    );
    const accessExpiresInMs = this.parseExpiresInMs(
      this.configService.get<string>('JWT_ACCESS_EXPIRES_IN')!,
    );

    const tokenRow = await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        hashedToken,
        expiresAt: new Date(Date.now() + refreshExpiresInMs),
      },
    });

    const accessToken = this.jwtService.sign(
      { sub: user.id, role: user.role },
      {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: Math.floor(accessExpiresInMs / 1000),
      },
    );

    const refreshToken = this.jwtService.sign(
      { sub: user.id, jti: tokenRow.id, secret },
      {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: Math.floor(refreshExpiresInMs / 1000),
      },
    );

    return { accessToken, refreshToken };
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
