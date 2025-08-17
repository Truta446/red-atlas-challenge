import { of } from 'rxjs';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { MetricsInterceptor } from './metrics.interceptor';
import { MetricsService } from './metrics.service';
import { register } from 'prom-client';

describe('MetricsInterceptor', () => {
  afterAll(() => {
    register.clear();
  });

  it('should start and end timer for http requests', (done) => {
    const endMock = jest.fn();
    const startTimerMock = jest.fn().mockReturnValue(endMock);

    const metrics = {
      httpLatency: { startTimer: startTimerMock },
    } as unknown as MetricsService;

    const interceptor = new MetricsInterceptor();
    (interceptor as any).metrics = metrics;

    const ctx = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({ method: 'get', routerPath: '/v1/test' }),
        getResponse: () => ({ statusCode: 201 }),
      }),
    } as unknown as ExecutionContext;

    const next: CallHandler = { handle: () => of('ok') } as any;

    interceptor.intercept(ctx, next).subscribe(() => {
      expect(startTimerMock).toHaveBeenCalledWith({ method: 'GET', route: '/v1/test' });
      expect(endMock).toHaveBeenCalledWith({ status: '201' });
      done();
    });
  });

  it('should bypass for non-http contexts', (done) => {
    const metrics = { httpLatency: { startTimer: jest.fn() } } as any;
    const interceptor = new MetricsInterceptor();
    (interceptor as any).metrics = metrics;
    const ctx = { getType: () => 'rpc' } as any;
    const next: CallHandler = { handle: () => of('ok') } as any;
    interceptor.intercept(ctx, next).subscribe((v) => {
      expect(v).toBe('ok');
      expect(metrics.httpLatency.startTimer).not.toHaveBeenCalled();
      done();
    });
  });
});
