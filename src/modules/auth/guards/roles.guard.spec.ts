import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

function ctxWithUser(user: any) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;
}

describe('RolesGuard', () => {
  let reflector: jest.Mocked<Reflector>;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as any;
    // Guard uses property injection (@Inject) instead of constructor injection
    guard = new RolesGuard();
    // Manually inject mocked Reflector for tests
    (guard as any).reflector = reflector;
  });

  it('allows when no roles metadata', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined as any);
    expect(guard.canActivate(ctxWithUser({ role: 'user' }))).toBe(true);
  });

  it('allows when user has required role', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    expect(guard.canActivate(ctxWithUser({ role: 'admin' }))).toBe(true);
  });

  it('throws when user missing', () => {
    reflector.getAllAndOverride.mockReturnValue(['user']);
    expect(() => guard.canActivate(ctxWithUser(undefined))).toThrow(ForbiddenException);
  });

  it('throws when role insufficient', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    expect(() => guard.canActivate(ctxWithUser({ role: 'user' }))).toThrow(ForbiddenException);
  });
});
