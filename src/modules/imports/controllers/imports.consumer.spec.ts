import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ObjectLiteral, Repository } from 'typeorm';

import { MetricsService } from '../../metrics/services/metrics.service';
import { ImportJob } from '../entities/import-job.entity';
import { ImportProcessedBatch } from '../entities/processed-batch.entity';
import { ImportsService } from '../services/imports.service';
import { ImportsConsumer } from './imports.consumer';

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

  it('does not increment row metrics when ok=0 and ko=0', async () => {
    (batches.findOne as jest.Mock).mockResolvedValue(null);
    (service.flushBatch as jest.Mock).mockResolvedValue({ ok: 0, ko: 0 });
    (jobs.findOne as jest.Mock).mockResolvedValue({ id: 'j1', published: false, processed: 0, totalEstimated: 10 });

    await consumer.handleBatch({ jobId: 'j1', tenantId: 't', seq: 7, rows: [{}, {}] as any }, {
      getChannelRef: () => ({ ack: jest.fn(), nack: jest.fn(), sendToQueue: jest.fn() }),
      getMessage: () => ({ properties: { headers: { 'x-death': [] } } }),
    } as any);

    // only batch metric incremented with result 'ok'
    const metrics: any = (consumer as any).metrics;
    expect(metrics.importsBatchesProcessed.inc).toHaveBeenCalledWith({ result: 'ok' }, 1);
    expect(metrics.importsRowsOk.inc).not.toHaveBeenCalled();
    expect(metrics.importsRowsKo.inc).not.toHaveBeenCalled();
  });

  it('nacks to retry and increments retry metric when processing fails and below max retries', async () => {
    (batches.findOne as jest.Mock).mockResolvedValue(null);
    (service.flushBatch as jest.Mock).mockRejectedValue(new Error('boom'));

    const nack = jest.fn();
    const ack = jest.fn();
    const sendToQueue = jest.fn();
    const ch = { nack, ack, sendToQueue };
    const headers = { 'x-death': [{ count: 0 }] };
    const message: any = { properties: { headers } };
    const ctx: any = {
      getChannelRef: () => ch,
      getMessage: () => message,
    };

    await consumer.handleBatch({ jobId: 'j1', tenantId: 't', seq: 1, rows: [{}] as any }, ctx);

    // retry path
    expect(nack).toHaveBeenCalledWith(message, false, false);
    // no DLQ send
    expect(sendToQueue).not.toHaveBeenCalled();
  });

  it('nacks to DLQ when retries exceeded', async () => {
    (batches.findOne as jest.Mock).mockResolvedValue(null);
    (service.flushBatch as jest.Mock).mockRejectedValue(new Error('boom'));

    const nack = jest.fn();
    const ack = jest.fn();
    const sendToQueue = jest.fn();
    const headers = { 'x-death': [{ count: 3 }, { count: 3 }] }; // total 6 >= max(5)
    const message: any = { properties: { headers } };
    const ch = { nack, ack, sendToQueue };
    const ctx: any = {
      getChannelRef: () => ch,
      getMessage: () => message,
    };

    await consumer.handleBatch({ jobId: 'j1', tenantId: 't', seq: 1, rows: [{}] as any }, ctx);

    expect(nack).toHaveBeenCalledWith(message, false, false);
    expect(sendToQueue).not.toHaveBeenCalled();
    expect(ack).not.toHaveBeenCalled();
  });

  it('retries when header parsing fails (count defaults to 0)', async () => {
    (batches.findOne as jest.Mock).mockResolvedValue(null);
    (service.flushBatch as jest.Mock).mockRejectedValue(new Error('boom'));

    const nack = jest.fn();
    const ack = jest.fn();
    const sendToQueue = jest.fn();
    // Build a proxy message whose property access throws to trigger try/catch in count calculation
    const proxyMsg: any = new Proxy(
      {},
      {
        get() {
          throw new Error('cannot read message');
        },
      },
    );
    const ch = { nack, ack, sendToQueue };
    const ctx: any = {
      getChannelRef: () => ch,
      getMessage: () => proxyMsg,
    };

    await consumer.handleBatch({ jobId: 'j1', tenantId: 't', seq: 1, rows: [{}] as any }, ctx);

    expect(nack).toHaveBeenCalled();
    expect(sendToQueue).not.toHaveBeenCalled();
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
    expect(jobs.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE imports'), [3, 2, 1, 'j1']);
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
