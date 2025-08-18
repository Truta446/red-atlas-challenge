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
        getRequest: () => ({
          method,
          url,
          body,
          params,
          user: { id: '11111111-1111-4111-8111-111111111111', tenantId: 't1' },
          headers: {},
        }),
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

  it('falls back to user.sub when user.id is absent (UUID required)', (done) => {
    const log = jest.fn().mockResolvedValue(undefined);
    const interceptor = new AuditInterceptor();
    (interceptor as any).audit = { log } as unknown as AuditService;

    const sub = '22222222-2222-4222-8222-222222222222';
    const ctx: ExecutionContext = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          url: '/v1/properties/1',
          body: { a: 1 },
          params: { id: '1' },
          user: { sub, tenantId: 't1' },
          headers: {},
        }),
        getResponse: () => ({}),
      }),
    } as any;

    const next: CallHandler = { handle: () => of('ok') } as any;
    interceptor.intercept(ctx, next).subscribe(() => {
      expect(log).toHaveBeenCalledWith(expect.objectContaining({ userId: sub }));
      done();
    });
  });

  it('sanitizes circular/stream bodies without truncation', (done) => {
    const log = jest.fn().mockResolvedValue(undefined);
    const interceptor = new AuditInterceptor();
    (interceptor as any).audit = { log } as unknown as AuditService;

    // Build a body with circular ref and a stream-like object (no huge field to avoid truncation)
    const circular: any = { name: 'c' };
    circular.self = circular;
    const streamLike = { pipe: () => {}, readable: true } as any;
    const body = { circular, file: streamLike };

    const ctx: ExecutionContext = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'PATCH',
          url: '/v1/properties/1',
          body,
          params: { id: '1' },
          user: { id: '11111111-1111-4111-8111-111111111111' },
          headers: {},
        }),
        getResponse: () => ({}),
      }),
    } as any;

    const next: CallHandler = { handle: () => of('ok') } as any;
    interceptor.intercept(ctx, next).subscribe(() => {
      const arg = (log.mock.calls[0] && log.mock.calls[0][0]) || {};
      expect(arg.after).toBeTruthy();
      // stream is replaced
      expect(arg.after.file).toBe('[stream]');
      // circular marker appears somewhere
      expect(JSON.stringify(arg.after)).toContain('[circular]');
      done();
    });
  });

  it('truncates very large payloads to a preview object', (done) => {
    const log = jest.fn().mockResolvedValue(undefined);
    const interceptor = new AuditInterceptor();
    (interceptor as any).audit = { log } as unknown as AuditService;

    const huge = 'x'.repeat(12_000);
    const body = { huge };

    const ctx: ExecutionContext = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'PATCH',
          url: '/v1/properties/1',
          body,
          params: { id: '1' },
          user: { id: '11111111-1111-4111-8111-111111111111' },
          headers: {},
        }),
        getResponse: () => ({}),
      }),
    } as any;

    const next: CallHandler = { handle: () => of('ok') } as any;
    interceptor.intercept(ctx, next).subscribe(() => {
      const arg = (log.mock.calls[0] && log.mock.calls[0][0]) || {};
      expect(arg.after).toEqual(
        expect.objectContaining({ truncated: true, size: expect.any(Number), preview: expect.any(String) }),
      );
      done();
    });
  });

  it('audits with null user/tenant/entity when not present', (done) => {
    const log = jest.fn().mockResolvedValue(undefined);
    const interceptor = new AuditInterceptor();
    (interceptor as any).audit = { log } as unknown as AuditService;

    const ctx: ExecutionContext = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({ method: 'PATCH', url: '', body: { z: 1 }, params: {}, headers: {} }),
        getResponse: () => ({}),
      }),
    } as any;

    const next: CallHandler = { handle: () => of('ok') } as any;
    interceptor.intercept(ctx, next).subscribe(() => {
      expect(log).toHaveBeenCalledWith(
        expect.objectContaining({ userId: null, tenantId: null, entity: null, entityId: null, after: { z: 1 } }),
      );
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
          userId: '11111111-1111-4111-8111-111111111111',
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

  it('uses x-tenant-id header when user.tenantId is absent and infers entity from non-versioned path', (done) => {
    const log = jest.fn().mockResolvedValue(undefined);
    const interceptor = new AuditInterceptor();
    (interceptor as any).audit = { log } as unknown as AuditService;

    const ctx = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'PATCH',
          url: '/properties/42', // non-versioned path, should infer 'properties'
          body: { x: 1 },
          params: { id: '42' },
          headers: { 'x-tenant-id': 'tx' },
          user: { id: '11111111-1111-4111-8111-111111111111' },
        }),
        getResponse: () => ({}),
      }),
    } as unknown as ExecutionContext;

    const next: CallHandler = { handle: () => of('ok') } as any;
    interceptor.intercept(ctx, next).subscribe(() => {
      expect(log).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tx', entity: 'properties', entityId: '42' }),
      );
      done();
    });
  });
});
