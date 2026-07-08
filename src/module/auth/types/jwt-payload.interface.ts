import { StaffRole } from '@prisma/client';
import { UserType } from '../../../common/types/request-user.interface';

export interface AccessTokenPayload {
  sub: string;
  userType: UserType;
  companyId?: string;
  role?: StaffRole;
}

export interface RefreshTokenPayload {
  sub: string;
  userType: UserType;
  jti: string;
  secret: string;
}
