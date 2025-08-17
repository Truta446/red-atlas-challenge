import { Controller, Inject, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MetricsService } from '../metrics/metrics.service';
import { ImportJob } from './import-job.entity';
import { ImportsService } from './imports.service';
import type { ImportBatchMessage } from './imports.types';
import { ImportProcessedBatch } from './processed-batch.entity';
import Redis from 'ioredis';
import { RedisLock } from '../../common/redis/redis-lock.util';

@Controller()
export class ImportsConsumer {
  private readonly logger = new Logger(ImportsConsumer.name);

  @Inject(ImportsService) private readonly service: ImportsService;
  @InjectRepository(ImportJob) private readonly jobs: Repository<ImportJob>;
  @InjectRepository(ImportProcessedBatch) private readonly batches: Repository<ImportProcessedBatch>;
  @Inject(MetricsService) private readonly metrics: MetricsService;

  @EventPattern('imports.batch')
  public async handleBatch(@Payload() message: ImportBatchMessage, @Ctx() context?: RmqContext): Promise<void> {
    const { jobId, tenantId, seq, rows } = message;
    const maxRetries = 5;
    const channel = context?.getChannelRef?.();
    const originalMsg = context?.getMessage?.();

    const ackIfPossible = () => {
      try {
        if (channel && originalMsg) channel.ack(originalMsg);
      } catch {}
    };
    const nackToRetry = () => {
      try {
        // Requeue=false so message dead-letters to the retry queue (with TTL)
        if (channel && originalMsg) channel.nack(originalMsg, false, false);
      } catch {}
    };
    const sendToDlqAndAck = () => {
      try {
        if (channel && originalMsg) {
          const payload = Buffer.from(JSON.stringify(message));
          channel.sendToQueue('imports.batch.dlq', payload, { contentType: 'application/json', persistent: true });
          channel.ack(originalMsg);
        }
      } catch {}
    };

    try {
      // Use a distributed lock per job to serialize updates and completion checks
      const runCritical = async () => {
        // Dedupe por (jobId, seq)
        const exists = await this.batches.findOne({ where: { jobId, seq } });
        if (exists) {
          this.logger.warn(`Duplicate batch ignored job=${jobId} seq=${seq}`);
          ackIfPossible();
          return;
        }

        const { ok, ko } = await this.service.flushBatch(tenantId, rows);
        // metrics
        this.metrics.importsBatchesProcessed.inc({ result: 'ok' }, 1);
        if (ok) this.metrics.importsRowsOk.inc(ok);
        if (ko) this.metrics.importsRowsKo.inc(ko);

        await this.jobs.query(
          `UPDATE imports
           SET processed = processed + $1,
               succeeded = succeeded + $2,
               failed = failed + $3
           WHERE id = $4`,
          [rows.length, ok, ko, jobId],
        );

        await this.batches.save(this.batches.create({ jobId, seq }));

        // Completar job quando published=true e processed >= total_estimated
        const job = await this.jobs.findOne({ where: { id: jobId } });
        if (job && job.published && job.totalEstimated && job.processed >= job.totalEstimated) {
          await this.jobs.update({ id: jobId }, { status: 'completed' });
        }

        ackIfPossible();
      };

      try {
        const lock = getRedisLock();
        await lock.withLock(`imports:job:${jobId}`, runCritical);
      } catch (lockErr) {
        // If Redis is unavailable or lock fails, proceed without lock to avoid stalling processing
        this.logger.warn(`Lock unavailable for job=${jobId}, proceeding without lock: ${String((lockErr as any)?.message || lockErr)}`);
        await runCritical();
      }
    } catch (e: any) {
      // Retry com limite via x-death ou contagem local
      const count = (() => {
        try {
          const hdr: any = originalMsg?.properties?.headers;
          const deaths = hdr?.['x-death'] as any[] | undefined;
          const total = Array.isArray(deaths) ? deaths.reduce((acc, d) => acc + (d?.count || 0), 0) : 0;
          return total;
        } catch {
          return 0;
        }
      })();

      if (count >= maxRetries) {
        this.logger.error(
          `Batch failed permanently after ${count} attempts job=${jobId} seq=${seq}: ${String(e?.message || e)}`,
        );
        this.metrics.importsBatchesProcessed.inc({ result: 'dlq' }, 1);
        sendToDlqAndAck();
      } else {
        this.logger.warn(
          `Batch failed (attempt ${count + 1}) job=${jobId} seq=${seq}: ${String(e?.message || e)} - retry with backoff`,
        );
        this.metrics.importsBatchesProcessed.inc({ result: 'retry' }, 1);
        nackToRetry();
      }
    }
  }
}

// Simple singleton RedisLock to avoid creating many connections per message
let _redisLock: RedisLock | null = null;
function getRedisLock(): RedisLock {
  if (_redisLock) return _redisLock;
  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  const client = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
  _redisLock = new RedisLock(client, { ttlMs: 10_000, keyPrefix: 'lock:' });
  return _redisLock;
}
