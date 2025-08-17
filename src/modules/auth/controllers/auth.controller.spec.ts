import { Test, TestingModule } from '@nestjs/testing';

import { AuthService } from '../services/auth.service';
import { AuthController } from './auth.controller';

describe('AuthController', () => {
  let controller: AuthController;
  let service: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            register: jest.fn(),
            login: jest.fn(),
            rotateRefresh: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(AuthController);
    service = module.get(AuthService) as any;
  });

  it('register propagates service error', async () => {
    (service.register as any).mockRejectedValue(new Error('email exists'));
    await expect(controller.register({ email: 'a@b.com', password: 'secret12', tenantId: 't' })).rejects.toThrow(
      'email exists',
    );
    expect(service.register).toHaveBeenCalled();
  });

  it('login propagates service error', async () => {
    (service.login as any).mockRejectedValue(new Error('invalid'));
    await expect(controller.login({ email: 'a@b.com', password: 'bad' })).rejects.toThrow('invalid');
    expect(service.login).toHaveBeenCalled();
  });

  it('refresh propagates service error', async () => {
    (service.rotateRefresh as any).mockRejectedValue(new Error('expired'));
    await expect(controller.refresh({ refreshToken: 'tok' })).rejects.toThrow('expired');
    expect(service.rotateRefresh).toHaveBeenCalled();
  });

  it('register delegates to service', async () => {
    (service.register as any).mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
    const res = await controller.register({ email: 'a@b.com', password: 'secret12', tenantId: 't' });
    expect(service.register).toHaveBeenCalledWith('a@b.com', 'secret12', 't');
    expect(res).toEqual({ accessToken: 'a', refreshToken: 'r' });
  });

  it('login delegates to service', async () => {
    (service.login as any).mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
    const res = await controller.login({ email: 'a@b.com', password: 'secret12' });
    expect(service.login).toHaveBeenCalledWith('a@b.com', 'secret12');
    expect(res).toEqual({ accessToken: 'a', refreshToken: 'r' });
  });

  it('refresh delegates to service', async () => {
    (service.rotateRefresh as any).mockResolvedValue({ accessToken: 'na', refreshToken: 'nr' });
    const res = await controller.refresh({ refreshToken: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature' });
    expect(service.rotateRefresh).toHaveBeenCalledWith('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature');
    expect(res).toEqual({ accessToken: 'na', refreshToken: 'nr' });
  });
});
