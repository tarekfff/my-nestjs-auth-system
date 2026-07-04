import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../../lib/database/prisma.service';

export interface CreateUserData {
  name: string;
  email: string;
  password: string;
  emailVerificationToken: string;
  emailVerificationExpires: Date;
}

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findAll(): Promise<User[]> {
    return this.prisma.user.findMany();
  }

  create(data: CreateUserData): Promise<User> {
    return this.prisma.user.create({ data });
  }

  updateEmailVerification(userId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        isEmailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });
  }

  setEmailVerificationToken(
    userId: string,
    token: string,
    expires: Date,
  ): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerificationToken: token,
        emailVerificationExpires: expires,
      },
    });
  }

  setPasswordResetToken(
    userId: string,
    token: string,
    expires: Date,
  ): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordResetToken: token, passwordResetExpires: expires },
    });
  }

  updatePassword(userId: string, hashedPassword: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });
  }

  async findByEmailVerificationToken(token: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { emailVerificationToken: token },
    });
    if (!user || !user.emailVerificationExpires) return null;
    if (user.emailVerificationExpires < new Date()) return null;
    return user;
  }

  async findByPasswordResetToken(token: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { passwordResetToken: token },
    });
    if (!user || !user.passwordResetExpires) return null;
    if (user.passwordResetExpires < new Date()) return null;
    return user;
  }
}
