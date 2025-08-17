import { MetricsService } from './metrics.service';
import { register } from 'prom-client';

describe('MetricsService', () => {
  afterAll(() => {
    // Clear metrics registry to stop any internal intervals
    register.clear();
  });

  it('registers metrics and can increment/observe', async () => {
    const ms = new MetricsService();

    // histogram start/observe
    const end = ms.httpLatency.startTimer({ method: 'GET', route: '/v1/x' });
    end({ status: '200' });

    // counters
    ms.importsBatchesProcessed.inc({ result: 'ok' }, 1);
    ms.importsRowsOk.inc(5);
    ms.importsRowsKo.inc(2);

    const out = await ms.registry.metrics();
    expect(out).toContain('http_request_duration_seconds');
    expect(out).toContain('imports_batches_processed_total');
    expect(out).toContain('imports_rows_ok_total');
    expect(out).toContain('imports_rows_ko_total');
  });
});
