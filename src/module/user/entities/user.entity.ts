import { Exclude } from 'class-transformer';
import { Role } from '@prisma/client';

export class UserEntity {
  id: string;
  name: string;
  email: string;
  role: Role;
  isEmailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;

  @Exclude()
  password: string;

  @Exclude()
  emailVerificationToken: string | null;

  @Exclude()
  emailVerificationExpires: Date | null;

  @Exclude()
  passwordResetToken: string | null;

  @Exclude()
  passwordResetExpires: Date | null;

  constructor(partial: Partial<UserEntity>) {
    Object.assign(this, partial);
  }
}
