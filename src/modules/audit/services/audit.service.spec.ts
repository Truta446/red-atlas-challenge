import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AuditLog } from '../entities/audit-log.entity';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  let service: AuditService;
  const repo = {
    create: jest.fn((x) => x),
    save: jest.fn(),
  } as unknown as jest.Mocked<Repository<AuditLog>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditService, { provide: getRepositoryToken(AuditLog), useValue: repo }],
    }).compile();

    service = module.get(AuditService);
    jest.clearAllMocks();
  });

  it('creates and saves an audit log', async () => {
    await service.log({ method: 'POST', path: '/v1/properties', userId: 'u', tenantId: 't' });
    expect(repo.create).toHaveBeenCalledWith({ method: 'POST', path: '/v1/properties', userId: 'u', tenantId: 't' });
    expect(repo.save).toHaveBeenCalledWith({ method: 'POST', path: '/v1/properties', userId: 'u', tenantId: 't' });
  });
});
