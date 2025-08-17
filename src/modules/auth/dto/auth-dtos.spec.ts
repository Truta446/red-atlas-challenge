import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto } from './login.dto';
import { RegisterDto } from './register.dto';
import { RefreshDto } from './refresh.dto';

describe('Auth DTOs validation', () => {
  it('LoginDto accepts valid and rejects invalid', async () => {
    const ok = plainToInstance(LoginDto, { email: 'a@b.com', password: 'secret12' });
    expect(await validate(ok)).toHaveLength(0);

    const bad = plainToInstance(LoginDto, { email: 'nope', password: '' } as any);
    const errs = await validate(bad);
    expect(errs.length).toBeGreaterThan(0);
  });

  it('RegisterDto accepts valid and rejects invalid', async () => {
    const ok = plainToInstance(RegisterDto, { email: 'a@b.com', password: 'secret12', role: 'user' });
    expect(await validate(ok)).toHaveLength(0);

    const bad = plainToInstance(RegisterDto, { email: 'x', password: '', role: 'owner' } as any);
    const errs = await validate(bad);
    expect(errs.length).toBeGreaterThan(0);
  });

  it('RefreshDto accepts valid and rejects invalid', async () => {
    // syntactically valid JWT-like string
    const ok = plainToInstance(RefreshDto, { refreshToken: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature' });
    expect(await validate(ok)).toHaveLength(0);

    const bad = plainToInstance(RefreshDto, { refreshToken: 123 } as any);
    const errs = await validate(bad);
    expect(errs.length).toBeGreaterThan(0);
  });
});
