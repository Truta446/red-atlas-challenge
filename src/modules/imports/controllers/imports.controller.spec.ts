import { Test, TestingModule } from '@nestjs/testing';
import { Readable } from 'node:stream';

import { AuthGuard } from '../../auth/guards/auth.guard';
import { ImportsService } from '../services/imports.service';
import { ImportsController } from './imports.controller';

describe('ImportsController', () => {
  let controller: ImportsController;
  let service: jest.Mocked<ImportsService>;

  const tenantUser = { tenantId: 'tenant-a' } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ImportsController],
      providers: [
        {
          provide: ImportsService,
          useValue: {
            enqueueImport: jest.fn(),
            getJob: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: jest.fn().mockResolvedValue(true) })
      .compile();

    controller = module.get(ImportsController);
    service = module.get(ImportsService);
  });

  it('create throws when CurrentUser is missing', async () => {
    const req: any = { headers: { 'content-type': 'text/csv' }, raw: Readable.from(['col1,col2\n']) };
    await expect(controller.create(req, 'idem-1', undefined as any)).rejects.toThrow();
    expect(service.enqueueImport).not.toHaveBeenCalled();
  });

  it('create rejects when Idempotency-Key is missing', async () => {
    const req: any = { headers: { 'content-type': 'text/csv' }, raw: Readable.from(['a,b\n']) };
    await expect(controller.create(req, undefined as any, tenantUser)).rejects.toThrow(
      'Missing Idempotency-Key header',
    );
    expect(service.enqueueImport).not.toHaveBeenCalled();
  });

  it('create rejects when Content-Type is not text/csv', async () => {
    const req: any = { headers: { 'content-type': 'application/json' }, raw: Readable.from(['{}']) };
    await expect(controller.create(req, 'idem-1', tenantUser)).rejects.toThrow('Content-Type must be text/csv');
    expect(service.enqueueImport).not.toHaveBeenCalled();
  });

  it('create rejects when Content-Type header is missing', async () => {
    const req: any = { headers: {}, raw: Readable.from(['col1,col2\n']) };
    await expect(controller.create(req, 'idem-1', tenantUser)).rejects.toThrow('Content-Type must be text/csv');
    expect(service.enqueueImport).not.toHaveBeenCalled();
  });

  it('create enqueues import and returns job id/status', async () => {
    const req: any = { headers: { 'content-type': 'text/csv' }, raw: Readable.from(['col1,col2\n']) };
    (service.enqueueImport as any).mockResolvedValue({ id: 'job-1', status: 'queued' });
    const res = await controller.create(req, 'idem-1', tenantUser);
    expect(service.enqueueImport).toHaveBeenCalledWith('tenant-a', 'idem-1', req.raw);
    expect(res).toEqual({ id: 'job-1', status: 'queued' });
  });

  it('getOne delegates to service.getJob with tenant and id', async () => {
    (service.getJob as any).mockResolvedValue({ id: 'job-1', status: 'processing' });
    const res = await controller.getOne('job-1', tenantUser);
    expect(service.getJob).toHaveBeenCalledWith('tenant-a', 'job-1');
    expect(res).toEqual({ id: 'job-1', status: 'processing' });
  });

  it('getOne throws when CurrentUser is missing', async () => {
    await expect(controller.getOne('job-1', undefined as any)).rejects.toThrow();
    expect(service.getJob).not.toHaveBeenCalled();
  });
});
