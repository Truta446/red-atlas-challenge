import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';

@Injectable()
export class AuditService {
  @InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>;

  public async log(entry: Partial<AuditLog>): Promise<void> {
    const e = this.repo.create(entry);
    await this.repo.save(e);
  }
}
