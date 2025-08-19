import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { Repository } from 'typeorm';

import { ImportJob } from '../../imports/entities/import-job.entity';
import { CsvRow, ImportBatchMessage } from '../../imports/imports.types';
import { Property } from '../../properties/entities/property.entity';

@Injectable()
export class ImportsService {
  private readonly logger = new Logger(ImportsService.name);

  @InjectRepository(ImportJob) private readonly jobs: Repository<ImportJob>;
  @InjectRepository(Property) private readonly props: Repository<Property>;
  @Inject('IMPORTS_RMQ') private readonly rmq: ClientProxy;

  public async getJob(tenantId: string, id: string): Promise<ImportJob> {
    const job = await this.jobs.findOne({ where: { id, tenantId } });
    if (!job) throw new Error('Import not found');
    return job;
  }

  public async enqueueImport(tenantId: string, key: string, stream: Readable): Promise<ImportJob> {
    // Idempotency: return existing job if same key for tenant
    let job = await this.jobs.findOne({ where: { tenantId, idempotencyKey: key } });
    if (job) return job;

    job = this.jobs.create({
      tenantId,
      idempotencyKey: key,
      status: 'processing',
      processed: 0,
      succeeded: 0,
      failed: 0,
    });
    job = await this.jobs.save(job);

    // Producer: stream and publish batches
    void this.publishStream(job.id, tenantId, stream).catch((e) => this.logger.error(e));
    return job;
  }

  private async publishStream(jobId: string, tenantId: string, stream: Readable): Promise<void> {
    const rl = createInterface({ input: stream, crlfDelay: Infinity });
    let header: string[] | null = null;
    const batch: CsvRow[] = [];
    const batchSize = 100;
    let seq = 0;
    let processed = 0;
    let failed = 0;

    try {
      for await (const line of rl) {
        if (!header) {
          header = this.parseCsvLine(line);
          continue;
        }
        if (!line.trim()) continue;
        const values = this.parseCsvLine(line);
        const row = this.mapRow(header, values);
        const err = this.validateRow(row);
        processed += 1;
        if (err) {
          failed += 1;
          // atualiza progressivo para entradas inválidas (não publicadas)
          await this.jobs.update({ id: jobId }, { processed, failed });
          continue;
        }
        batch.push(row);
        if (batch.length >= batchSize) {
          const msg: ImportBatchMessage = { jobId, tenantId, seq, rows: [...batch] };
          this.rmq.emit<ImportBatchMessage>('imports.batch', msg).subscribe({ error: (e) => this.logger.error(e) });
          seq += 1;
          batch.length = 0;
          // também pode atualizar total_estimated
          await this.jobs.increment({ id: jobId }, 'totalEstimated', batchSize);
        }
      }

      if (batch.length > 0) {
        const msg: ImportBatchMessage = { jobId, tenantId, seq, rows: [...batch] };
        this.rmq.emit<ImportBatchMessage>('imports.batch', msg).subscribe({ error: (e) => this.logger.error(e) });
        seq += 1;
        await this.jobs.increment({ id: jobId }, 'totalEstimated', batch.length);
        batch.length = 0;
      }

      // marcar publicado
      await this.jobs.update({ id: jobId }, { published: true });
    } catch (e: any) {
      await this.jobs.update({ id: jobId }, { status: 'failed', error: String(e?.message || e) });
      throw e;
    }
  }

  private parseCsvLine(line: string): string[] {
    // naive CSV split (no quotes support). For challenge simplicity.
    return line.split(',').map((s) => s.trim());
  }

  private mapRow(header: string[], values: string[]): CsvRow {
    const obj: Record<string, string> = {};
    header.forEach((h, i) => (obj[h] = values[i] ?? ''));
    return {
      address: obj.address,
      sector: obj.sector,
      type: obj.type,
      price: Number(obj.price),
      latitude: Number(obj.latitude),
      longitude: Number(obj.longitude),
    };
  }

  private validateRow(row: CsvRow): string | null {
    if (!row.address || !row.sector || !row.type) return 'missing required string fields';
    if (!Number.isFinite(row.price) || row.price <= 0) return 'invalid price';
    if (!Number.isFinite(row.latitude) || !Number.isFinite(row.longitude)) return 'invalid coords';
    return null;
  }

  public async flushBatch(tenantId: string, rows: CsvRow[]): Promise<{ ok: number; ko: number }> {
    if (rows.length === 0) return { ok: 0, ko: 0 };

    // Upsert strategy: insert ignoring duplicates (no unique constraint defined for properties here)
    // Compute valuation: simplistic placeholder factor 1.0 (can be replaced by real model)

    const values = rows.map((r) => ({
      tenantId,
      address: r.address,
      sector: r.sector,
      type: r.type,
      price: r.price,
      location: () => `ST_SetSRID(ST_MakePoint(${r.longitude}, ${r.latitude}), 4326)`,
    }));

    try {
      const insertResult = await this.props
        .createQueryBuilder()
        .insert()
        .values(values as any)
        .orIgnore() // ignore if duplicate according to any existing unique index (if any)
        .returning('id')
        .execute();

      const insertedIds: string[] = (insertResult.identifiers || []).map((idObj: any) => idObj.id).filter(Boolean);

      if (insertedIds.length > 0) {
        // Simple on-the-fly valuation: set valuation = price
        await this.props
          .createQueryBuilder()
          .update()
          .set({ valuation: () => 'price' })
          .whereInIds(insertedIds)
          .execute();
      }

      return { ok: rows.length, ko: 0 };
    } catch (e) {
      this.logger.error(e);
      return { ok: 0, ko: rows.length };
    }
  }
}
