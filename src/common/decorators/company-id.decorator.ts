import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Only valid on routes guarded by @CompanyScoped() — reads the companyId
 * that guard already verified from the JWT. Never sourced from body/query/params (R16).
 */
export const CompanyId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<{ companyId?: string }>();
    return request.companyId!;
  },
);
