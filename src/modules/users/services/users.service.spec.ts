import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../entities/user.entity';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let repo: jest.Mocked<Repository<User>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(UsersService);
    repo = module.get(getRepositoryToken(User));
  });

  it('changes role when user exists in tenant', async () => {
    const user = { id: 'u1', tenantId: 't1', role: 'user' } as any as User;
    (repo.findOne as any).mockResolvedValue(user);
    (repo.save as any).mockImplementation(async (u: User) => u);

    const res = await service.changeRole('u1', 't1', 'admin');
    expect(res.role).toBe('admin');
    expect(repo.save).toHaveBeenCalledWith({ ...user, role: 'admin' });
  });

  it('throws NotFound when user not in tenant', async () => {
    (repo.findOne as any).mockResolvedValue(null);
    await expect(service.changeRole('u1', 't1', 'admin')).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.save).not.toHaveBeenCalled();
  });
});
