import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { AuthService } from './auth.service';

jest.mock('../../common/security/password.util', () => ({
  hashPassword: jest.fn(async () => 'hashed_pw'),
  verifyPassword: jest.fn(async (pw: string, stored: string) => stored === 'ok' && pw === 'pw'),
}));

const { hashPassword, verifyPassword } = jest.requireMock('../../common/security/password.util');

describe('AuthService', () => {
  let service: AuthService;
  let users: jest.Mocked<Repository<User>>;
  let jwt: jest.Mocked<JwtService>;

  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(),
            verifyAsync: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    users = module.get(getRepositoryToken(User));
    jwt = module.get(JwtService) as any;
  });

  it('registers a new user and returns tokens', async () => {
    (users.findOne as jest.Mock).mockResolvedValue(null);
    (users.create as jest.Mock).mockImplementation((u: Partial<User>) => ({ id: 'u1', ...u }));
    let saved = 0;
    (users.save as jest.Mock).mockImplementation(async (u: any) => {
      saved++;
      return { ...u, id: u.id || 'u1' };
    });
    (jwt.signAsync as jest.Mock).mockResolvedValueOnce('access').mockResolvedValueOnce('refresh');

    const res = await service.register('a@b.com', 'pw', 't1');

    expect(hashPassword).toHaveBeenCalled();
    expect(jwt.signAsync).toHaveBeenCalledTimes(2);
    expect(users.save).toHaveBeenCalledTimes(2);
    expect(res).toEqual({ accessToken: 'access', refreshToken: 'refresh' });
  });

  it('register fails when email exists', async () => {
    (users.findOne as jest.Mock).mockResolvedValue({ id: 'exists' });
    await expect(service.register('a@b.com', 'pw')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('login succeeds with valid credentials', async () => {
    (users.findOne as jest.Mock).mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      role: 'user',
      tenantId: 't',
      passwordHash: 'ok',
    });
    // Ensure the password check passes regardless of the underlying mock implementation
    (verifyPassword as jest.Mock).mockResolvedValue(true);
    (jwt.signAsync as jest.Mock).mockResolvedValueOnce('a').mockResolvedValueOnce('r');
    const res = await service.login('a@b.com', 'pw');
    expect(verifyPassword).toHaveBeenCalled();
    expect(users.save).toHaveBeenCalled();
    expect(res).toEqual({ accessToken: 'a', refreshToken: 'r' });
  });

  it('login fails with invalid password', async () => {
    (users.findOne as jest.Mock).mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      role: 'user',
      tenantId: 't',
      passwordHash: 'ok',
    });
    // verifyPassword mocked returns true only for pw==='pw'; pass different
    await expect(service.login('a@b.com', 'bad')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rotateRefresh succeeds when token valid and matches stored hash', async () => {
    (jwt.verifyAsync as jest.Mock).mockResolvedValue({ sub: 'u1', email: 'a@b.com', tenantId: 't' });
    // Pre-hash to match stored sha256 (use require to avoid vm modules flag)
    const crypto = require('crypto');
    const rt = 'refresh-token';
    const hash = crypto.createHash('sha256').update(rt).digest('hex');
    (users.findOne as jest.Mock).mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      tenantId: 't',
      role: 'user',
      refreshTokenHash: hash,
    });
    (jwt.signAsync as jest.Mock).mockResolvedValueOnce('new-access').mockResolvedValueOnce('new-refresh');

    const res = await service.rotateRefresh(rt);
    expect(users.save).toHaveBeenCalled();
    expect(res).toEqual({ accessToken: 'new-access', refreshToken: 'new-refresh' });
  });

  it('rotateRefresh fails on invalid token', async () => {
    (jwt.verifyAsync as jest.Mock).mockRejectedValue(new Error('bad'));
    await expect(service.rotateRefresh('rt')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rotateRefresh fails when stored hash mismatch', async () => {
    (jwt.verifyAsync as jest.Mock).mockResolvedValue({ sub: 'u1', email: 'a@b.com', tenantId: 't' });
    (users.findOne as jest.Mock).mockResolvedValue({ id: 'u1', refreshTokenHash: 'other' });
    await expect(service.rotateRefresh('rt')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
