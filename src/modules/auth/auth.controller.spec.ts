import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

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
