import { ClientProxy } from '@nestjs/microservices';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Readable } from 'node:stream';
import { Repository } from 'typeorm';

import { Property } from '../../properties/entities/property.entity';
import { ImportJob } from '../entities/import-job.entity';
import { ImportsService } from './imports.service';

function mockRepo() {
  return {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    increment: jest.fn(),
    createQueryBuilder: jest.fn(),
  } as any as jest.Mocked<Repository<any>>;
}

describe('ImportsService', () => {
  let service: ImportsService;
  let jobs: jest.Mocked<Repository<ImportJob>>;
  let props: jest.Mocked<Repository<Property>>;
  let rmq: jest.Mocked<ClientProxy>;

  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportsService,
        { provide: getRepositoryToken(ImportJob), useValue: mockRepo() },
        { provide: getRepositoryToken(Property), useValue: mockRepo() },
        { provide: 'IMPORTS_RMQ', useValue: { emit: jest.fn(() => ({ subscribe: jest.fn() })) } },
      ],
    }).compile();

    service = module.get(ImportsService);
    jobs = module.get(getRepositoryToken(ImportJob));
    props = module.get(getRepositoryToken(Property));
    rmq = module.get('IMPORTS_RMQ');
  });

  it('flushBatch returns {0,0} when rows is empty', async () => {
    const res = await service.flushBatch('t', []);
    expect(res).toEqual({ ok: 0, ko: 0 });
  });

  it('flushBatch returns ok and skips valuation update when no rows inserted', async () => {
    const insertQB: any = {
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ identifiers: [] }),
    };
    const updateQB: any = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      whereInIds: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({}),
    };
    (props.createQueryBuilder as jest.Mock).mockReturnValueOnce(insertQB).mockReturnValueOnce(updateQB);

    const rows = [
      { address: 'a', sector: 's', type: 't', price: 10, latitude: 1, longitude: 2 },
      { address: 'b', sector: 's', type: 't', price: 20, latitude: 3, longitude: 4 },
    ];

    const res = await service.flushBatch('t', rows as any);
    expect(res).toEqual({ ok: 2, ko: 0 });
    // Since no identifiers were returned, valuation update should not be executed
    expect(updateQB.update).not.toHaveBeenCalled();
  });

  it('publishStream emits when batch reaches 1000 rows and increments totalEstimated accordingly', async () => {
    const header = 'address,sector,type,price,latitude,longitude\n';
    const rows = Array.from({ length: 1001 }, (_, i) => `A${i},S,T,123,1,2\n`).join('');
    const stream = Readable.from([header, rows]);

    (jobs.increment as jest.Mock).mockResolvedValue(undefined);
    (jobs.update as jest.Mock).mockResolvedValue(undefined);

    await (service as any).publishStream('job-1000', 'tenant-a', stream);

    // One emit for first 1000, one emit for the remaining 1
    expect(rmq.emit).toHaveBeenCalledTimes(2);
    const topics = (rmq.emit as jest.Mock).mock.calls.map((c: any[]) => c[0]);
    expect(topics.every((t: string) => t === 'imports.batch')).toBe(true);
    // increments called with 1000 and then 1
    expect(jobs.increment).toHaveBeenNthCalledWith(1, { id: 'job-1000' }, 'totalEstimated', 1000);
    expect(jobs.increment).toHaveBeenNthCalledWith(2, { id: 'job-1000' }, 'totalEstimated', 1);
    // published flag set at the end
    expect(jobs.update).toHaveBeenCalledWith({ id: 'job-1000' }, { published: true });
  });

  it('getJob returns job or throws', async () => {
    (jobs.findOne as jest.Mock).mockResolvedValueOnce({ id: 'j1' } as any);
    await expect(service.getJob('t', 'j1')).resolves.toEqual({ id: 'j1' });
    (jobs.findOne as jest.Mock).mockResolvedValueOnce(null);
    await expect(service.getJob('t', 'missing')).rejects.toThrow('Import not found');
  });

  it('enqueueImport returns existing job for same idempotency key', async () => {
    (jobs.findOne as jest.Mock).mockResolvedValueOnce({ id: 'existing' } as any);
    const res = await service.enqueueImport('t', 'key', Readable.from(['a,b\n']));
    expect(res.id).toBe('existing');
    expect(jobs.save).not.toHaveBeenCalled();
  });

  it('enqueueImport creates new job and publishes stream', async () => {
    (jobs.findOne as jest.Mock).mockResolvedValueOnce(null);
    (jobs.create as jest.Mock).mockReturnValue({ id: 'j1' });
    (jobs.save as jest.Mock).mockResolvedValue({ id: 'j1' });
    const spy = jest.spyOn<any, any>(service as any, 'publishStream').mockResolvedValue(undefined);

    const res = await service.enqueueImport('t', 'key', Readable.from(['h1\n']));
    expect(res.id).toBe('j1');
    expect(spy).toHaveBeenCalled();
  });

  it('flushBatch inserts properties and updates valuation', async () => {
    const insertQB: any = {
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ identifiers: [{ id: 'p1' }, { id: 'p2' }] }),
    };
    const updateQB: any = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      whereInIds: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({}),
    };
    (props.createQueryBuilder as jest.Mock).mockReturnValueOnce(insertQB).mockReturnValueOnce(updateQB);

    const rows = [
      { address: 'a', sector: 's', type: 't', price: 10, latitude: 1, longitude: 2 },
      { address: 'b', sector: 's', type: 't', price: 20, latitude: 3, longitude: 4 },
    ];
    const res = await service.flushBatch('t', rows as any);
    expect(res).toEqual({ ok: 2, ko: 0 });
    expect(insertQB.insert).toHaveBeenCalled();
    expect(updateQB.update).toHaveBeenCalled();
  });

  it('flushBatch returns ko when insert fails', async () => {
    const insertQB: any = {
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      execute: jest.fn().mockRejectedValue(new Error('db')),
    };
    (props.createQueryBuilder as jest.Mock).mockReturnValueOnce(insertQB);

    const rows = [{ address: 'a', sector: 's', type: 't', price: 10, latitude: 1, longitude: 2 }] as any;
    const res = await service.flushBatch('t', rows);
    expect(res).toEqual({ ok: 0, ko: 1 });
  });

  it('publishStream publishes remaining batch and marks published', async () => {
    // header + one valid row
    const stream = Readable.from(['address,sector,type,price,latitude,longitude\n', 'A,S,T,123,1,2\n']);
    (jobs.increment as jest.Mock).mockResolvedValue(undefined);
    (jobs.update as jest.Mock).mockResolvedValue(undefined);

    await (service as any).publishStream('job-1', 'tenant-a', stream);

    expect(rmq.emit).toHaveBeenCalledTimes(1);
    expect((rmq.emit as jest.Mock).mock.calls[0][0]).toBe('imports.batch');
    expect(jobs.increment).toHaveBeenCalledWith({ id: 'job-1' }, 'totalEstimated', 1);
    expect(jobs.update).toHaveBeenCalledWith({ id: 'job-1' }, { published: true });
  });

  it('publishStream counts invalid rows and does not emit for them', async () => {
    const stream = Readable.from([
      'address,sector,type,price,latitude,longitude\n',
      'A,S,T,-1,1,2\n', // invalid price
    ]);
    (jobs.update as jest.Mock).mockResolvedValue(undefined);

    await (service as any).publishStream('job-2', 'tenant-a', stream);

    // One update for processed/failed, then one for published flag
    expect(jobs.update).toHaveBeenCalledWith({ id: 'job-2' }, { processed: 1, failed: 1 });
    expect(rmq.emit).not.toHaveBeenCalled();
    expect(jobs.update).toHaveBeenCalledWith({ id: 'job-2' }, { published: true });
  });

  it('publishStream sets job failed on error and rethrows', async () => {
    const stream = Readable.from(['header\n', 'row\n']);
    const spy = jest.spyOn<any, any>(service as any, 'parseCsvLine').mockImplementation(() => {
      throw new Error('parse');
    });
    (jobs.update as jest.Mock).mockResolvedValue(undefined);

    await expect((service as any).publishStream('job-3', 't', stream)).rejects.toThrow('parse');
    expect(jobs.update).toHaveBeenCalledWith({ id: 'job-3' }, { status: 'failed', error: 'parse' });
    spy.mockRestore();
  });
});
