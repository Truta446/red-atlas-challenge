import { ExecutionContext } from '@nestjs/common';
import { currentUserFromContext } from './current-user.decorator';

function makeCtx(user?: any): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }) as any,
  } as unknown as ExecutionContext;
}

describe('CurrentUser decorator', () => {
  it('returns req.user when present', () => {
    const user = { sub: 'u1', email: 'a@b.com', role: 'user', tenantId: 't1' };
    const res = currentUserFromContext(makeCtx(user));
    expect(res).toEqual(user);
  });

  it('returns undefined when user missing', () => {
    const res = currentUserFromContext(makeCtx());
    expect(res).toBeUndefined();
  });
});
