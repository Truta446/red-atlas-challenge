import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { AuthGuard } from './auth.guard';

function ctxWithHeaders(headers: any) {
  const req: any = { headers };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as any;
}

describe('AuthGuard', () => {
  let jwt: jest.Mocked<JwtService>;
  let guard: AuthGuard;

  beforeEach(() => {
    jwt = { verifyAsync: jest.fn() } as any;
    // Guard uses property injection (@Inject) instead of constructor injection
    guard = new AuthGuard();
    // Manually inject mocked JwtService for tests
    (guard as any).jwt = jwt;
  });

  it('throws when missing bearer token', async () => {
    await expect(guard.canActivate(ctxWithHeaders({}))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws when verification fails', async () => {
    jwt.verifyAsync.mockRejectedValue(new Error('bad'));
    const headers = { authorization: 'Bearer token' };
    await expect(guard.canActivate(ctxWithHeaders(headers))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('sets req.user and allows when token valid', async () => {
    const payload = { sub: 'u1', email: 'a@b.com', role: 'admin', tenantId: 't' } as any;
    jwt.verifyAsync.mockResolvedValue(payload);
    const headers: any = { authorization: 'Bearer good' };
    const ctx: any = ctxWithHeaders(headers);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    const req = ctx.switchToHttp().getRequest();
    expect(req.user).toEqual(payload);
  });
});
