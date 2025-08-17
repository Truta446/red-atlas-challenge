import { of } from 'rxjs';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { AuditInterceptor } from './audit.interceptor';
import { AuditService } from './audit.service';

describe('AuditInterceptor', () => {
  function httpCtx(
    method: string,
    url = '/v1/properties/123',
    body: any = { a: 1 },
    params: any = { id: '123' },
  ): ExecutionContext {
    return {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({ method, url, body, params, user: { id: 'u1', tenantId: 't1' }, headers: {} }),
        getResponse: () => ({}),
      }),
    } as any;
  }

  it('bypasses non-http', (done) => {
    const interceptor = new AuditInterceptor();
    (interceptor as any).audit = { log: jest.fn() } as unknown as AuditService;
    const ctx = { getType: () => 'rpc' } as any;
    const next: CallHandler = { handle: () => of('ok') } as any;
    interceptor.intercept(ctx, next).subscribe((v) => {
      expect(v).toBe('ok');
      done();
    });
  });

  it('audits mutating methods and calls AuditService.log', (done) => {
    const log = jest.fn().mockResolvedValue(undefined);
    const interceptor = new AuditInterceptor();
    (interceptor as any).audit = { log } as unknown as AuditService;

    const ctx = httpCtx('POST');
    const next: CallHandler = { handle: () => of({ ok: true }) } as any;

    interceptor.intercept(ctx, next).subscribe(() => {
      expect(log).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          path: '/v1/properties/123',
          userId: 'u1',
          tenantId: 't1',
          entity: 'properties',
          entityId: '123',
          after: { a: 1 },
        }),
      );
      done();
    });
  });

  it('does not audit safe methods (GET)', (done) => {
    const log = jest.fn();
    const interceptor = new AuditInterceptor();
    (interceptor as any).audit = { log } as unknown as AuditService;
    const ctx = httpCtx('GET');
    const next: CallHandler = { handle: () => of('ok') } as any;
    interceptor.intercept(ctx, next).subscribe(() => {
      expect(log).not.toHaveBeenCalled();
      done();
    });
  });

  it('swallows errors from AuditService.log (best-effort)', (done) => {
    const log = jest.fn().mockRejectedValue(new Error('db'));
    const interceptor = new AuditInterceptor();
    (interceptor as any).audit = { log } as unknown as AuditService;

    const ctx = httpCtx('DELETE');
    const next: CallHandler = { handle: () => of({ ok: true }) } as any;
    interceptor.intercept(ctx, next).subscribe((v) => {
      expect(v).toEqual({ ok: true });
      expect(log).toHaveBeenCalled();
      done();
    });
  });
});
