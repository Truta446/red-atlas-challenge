import { hashPassword, verifyPassword } from './password.util';

describe('password.util', () => {
  it('hashes and verifies correctly', async () => {
    const hash = await hashPassword('secret');
    expect(hash).toContain('.');
    expect(await verifyPassword('secret', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  it('verify returns false for malformed stored value', async () => {
    expect(await verifyPassword('x', 'not-split')).toBe(false);
  });
});
