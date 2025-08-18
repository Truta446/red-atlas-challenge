import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User, UserRole } from '../entities/user.entity';

@Injectable()
export class UsersService {
  @InjectRepository(User) private readonly repo: Repository<User>;

  public async findAllByTenant(tenantId: string): Promise<User[]> {
    return this.repo.find({ where: { tenantId } });
  }

  public async changeRole(id: string, tenantId: string, role: UserRole): Promise<User> {
    const user = await this.repo.findOne({ where: { id, tenantId } });
    if (!user) throw new NotFoundException('User not found');
    user.role = role;
    return this.repo.save(user);
  }
}
