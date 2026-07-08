import { applyDecorators, UseGuards } from '@nestjs/common';
import { CompanyScopedGuard } from '../guards/company-scoped.guard';

export const CompanyScoped = () =>
  applyDecorators(UseGuards(CompanyScopedGuard));
