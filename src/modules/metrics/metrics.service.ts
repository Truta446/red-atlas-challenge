import { Injectable } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Histogram, Registry } from 'prom-client';

@Injectable()
export class MetricsService {
  public readonly registry: Registry;
  public readonly httpLatency: Histogram<string>;
  public readonly importsBatchesProcessed: Counter<string>;
  public readonly importsRowsOk: Counter<string>;
  public readonly importsRowsKo: Counter<string>;

  public constructor() {
    this.registry = new Registry();
    collectDefaultMetrics({ register: this.registry });

    this.httpLatency = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });

    this.importsBatchesProcessed = new Counter({
      name: 'imports_batches_processed_total',
      help: 'Total number of import batches processed',
      labelNames: ['result'],
      registers: [this.registry],
    });

    this.importsRowsOk = new Counter({
      name: 'imports_rows_ok_total',
      help: 'Total number of import rows succeeded',
      registers: [this.registry],
    });

    this.importsRowsKo = new Counter({
      name: 'imports_rows_ko_total',
      help: 'Total number of import rows failed',
      registers: [this.registry],
    });
  }
}
