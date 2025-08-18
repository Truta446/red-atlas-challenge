import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { UpdateUserRoleDto } from '../dto/update-user-role.dto';
import { UsersService } from '../services/users.service';
import { UsersController } from './users.controller';

describe('UsersController', () => {
  let controller: UsersController;
  let service: jest.Mocked<UsersService>;

  const adminUser = { sub: 'admin1', role: 'admin', tenantId: 't1' } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            changeRole: jest.fn(),
            findAllByTenant: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: jest.fn().mockResolvedValue(true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn().mockResolvedValue(true) })
      .compile();

    controller = module.get(UsersController);
    service = module.get(UsersService);
  });

  it('PATCH /users/:id/role calls service.changeRole with tenant', async () => {
    const dto: UpdateUserRoleDto = { role: 'admin' } as any;
    (service.changeRole as any).mockResolvedValue({ id: 'u1', role: 'admin' });
    const res = await controller.changeRole('u1', dto, adminUser);
    expect(service.changeRole).toHaveBeenCalledWith('u1', 't1', 'admin');
    expect(res).toEqual({ id: 'u1', role: 'admin' });
  });

  it('GET /users lists by tenant', async () => {
    (service.findAllByTenant as any).mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]);
    const res = await controller.list(adminUser);
    expect(service.findAllByTenant).toHaveBeenCalledWith('t1');
    expect(res).toEqual([{ id: 'u1' }, { id: 'u2' }]);
  });

  it('forbids changing own role', async () => {
    const dto: UpdateUserRoleDto = { role: 'user' } as any;
    await expect(controller.changeRole('admin1', dto, adminUser)).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.changeRole).not.toHaveBeenCalled();
  });
});
