import { StaffRole } from '@prisma/client';

export type UserType = 'COMPANY' | 'STAFF';

export interface RequestUser {
  userId: string;
  userType: UserType;
  companyId?: string;
  role?: StaffRole;
}
