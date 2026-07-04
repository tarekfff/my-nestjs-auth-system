import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../../lib/database/prisma.service';

export interface CreateUserData {
  name: string;
  email: string;
  password: string;
  emailVerificationCode: string;
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

  markEmailVerified(userId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        isEmailVerified: true,
        emailVerificationCode: null,
        emailVerificationExpires: null,
      },
    });
  }

  setEmailVerificationCode(
    userId: string,
    code: string,
    expires: Date,
  ): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        emailVerificationCode: code,
        emailVerificationExpires: expires,
      },
    });
  }

  setPasswordResetCode(
    userId: string,
    code: string,
    expires: Date,
  ): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordResetCode: code, passwordResetExpires: expires },
    });
  }

  updatePassword(userId: string, hashedPassword: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        passwordResetCode: null,
        passwordResetExpires: null,
      },
    });
  }
}
