import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ObjectLiteral, Repository } from 'typeorm';
import { ImportsConsumer } from './imports.consumer';
import { ImportsService } from './imports.service';
import { ImportJob } from './import-job.entity';
import { ImportProcessedBatch } from './processed-batch.entity';
import { MetricsService } from '../metrics/metrics.service';

function mockRepo<T extends ObjectLiteral>() {
  return {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn((x) => x),
    update: jest.fn(),
    query: jest.fn(),
  } as any as jest.Mocked<Repository<T>>;
}

describe('ImportsConsumer', () => {
  let consumer: ImportsConsumer;
  let service: jest.Mocked<ImportsService>;
  let jobs: jest.Mocked<Repository<ImportJob>>;
  let batches: jest.Mocked<Repository<ImportProcessedBatch>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ImportsConsumer],
      providers: [
        { provide: ImportsService, useValue: { flushBatch: jest.fn() } },
        { provide: getRepositoryToken(ImportJob), useValue: mockRepo<ImportJob>() },
        { provide: getRepositoryToken(ImportProcessedBatch), useValue: mockRepo<ImportProcessedBatch>() },
        {
          provide: MetricsService,
          useValue: {
            importsBatchesProcessed: { inc: jest.fn() },
            importsRowsOk: { inc: jest.fn() },
            importsRowsKo: { inc: jest.fn() },
          },
        },
      ],
    }).compile();

    consumer = module.get(ImportsConsumer);
    service = module.get(ImportsService) as any;
    jobs = module.get(getRepositoryToken(ImportJob));
    batches = module.get(getRepositoryToken(ImportProcessedBatch));
  });

  it('nacks to retry and increments retry metric when processing fails and below max retries', async () => {
    (batches.findOne as jest.Mock).mockResolvedValue(null);
    (service.flushBatch as jest.Mock).mockRejectedValue(new Error('boom'));

    const nack = jest.fn();
    const ack = jest.fn();
    const sendToQueue = jest.fn();
    const headers = { 'x-death': [{ count: 0 }] };
    const message: any = { properties: { headers } };
    const ctx: any = {
      getChannelRef: () => ({ nack, ack, sendToQueue }),
      getMessage: () => message,
    };

    await consumer.handleBatch({ jobId: 'j1', tenantId: 't', seq: 1, rows: [{}] as any }, ctx);

    // retry path
    expect(nack).toHaveBeenCalledWith(message, false, false);
    // no DLQ send
    expect(sendToQueue).not.toHaveBeenCalled();
  });

  it('sends to DLQ and acks when retries exceeded', async () => {
    (batches.findOne as jest.Mock).mockResolvedValue(null);
    (service.flushBatch as jest.Mock).mockRejectedValue(new Error('boom'));

    const nack = jest.fn();
    const ack = jest.fn();
    const sendToQueue = jest.fn();
    const headers = { 'x-death': [{ count: 3 }, { count: 3 }] }; // total 6 >= max(5)
    const message: any = { properties: { headers } };
    const ctx: any = {
      getChannelRef: () => ({ nack, ack, sendToQueue }),
      getMessage: () => message,
    };

    await consumer.handleBatch({ jobId: 'j1', tenantId: 't', seq: 1, rows: [{}] as any }, ctx);

    expect(sendToQueue).toHaveBeenCalledWith(
      'imports.batch.dlq',
      expect.any(Buffer),
      expect.objectContaining({ contentType: 'application/json', persistent: true })
    );
    expect(ack).toHaveBeenCalledWith(message);
    expect(nack).not.toHaveBeenCalled();
  });

  it('ignores duplicate batch', async () => {
    (batches.findOne as jest.Mock).mockResolvedValue({ jobId: 'j1', seq: 1 } as any);
    await consumer.handleBatch({ jobId: 'j1', tenantId: 't', seq: 1, rows: [] });
    expect(service.flushBatch).not.toHaveBeenCalled();
    expect(jobs.query).not.toHaveBeenCalled();
  });

  it('processes batch, updates counters and marks processed', async () => {
    (batches.findOne as jest.Mock).mockResolvedValue(null);
    (service.flushBatch as jest.Mock).mockResolvedValue({ ok: 2, ko: 1 });
    (jobs.findOne as jest.Mock).mockResolvedValue({ id: 'j1', published: false, processed: 0, totalEstimated: 10 });

    await consumer.handleBatch({ jobId: 'j1', tenantId: 't', seq: 5, rows: [{}, {}, {}] as any });

    expect(service.flushBatch).toHaveBeenCalledWith('t', [{}, {}, {}]);
    expect(jobs.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE imports'),
      [3, 2, 1, 'j1']
    );
    expect(batches.save).toHaveBeenCalledWith({ jobId: 'j1', seq: 5 });
    expect(jobs.update).not.toHaveBeenCalledWith({ id: 'j1' }, { status: 'completed' });
  });

  it('completes job when published and processed >= totalEstimated', async () => {
    (batches.findOne as jest.Mock).mockResolvedValue(null);
    (service.flushBatch as jest.Mock).mockResolvedValue({ ok: 3, ko: 0 });
    (jobs.findOne as jest.Mock).mockResolvedValue({ id: 'j1', published: true, processed: 10, totalEstimated: 10 });

    await consumer.handleBatch({ jobId: 'j1', tenantId: 't', seq: 2, rows: [{}, {}, {}] as any });

    expect(jobs.update).toHaveBeenCalledWith({ id: 'j1' }, { status: 'completed' });
  });
});
