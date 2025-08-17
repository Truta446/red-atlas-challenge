import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentUserPayload {
  sub: string;
  email: string;
  role: 'user' | 'admin';
  tenantId: string;
}

export function currentUserFromContext(ctx: ExecutionContext): CurrentUserPayload | undefined {
  const req = ctx.switchToHttp().getRequest();
  return req.user as CurrentUserPayload | undefined;
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): CurrentUserPayload | undefined => currentUserFromContext(ctx),
);
