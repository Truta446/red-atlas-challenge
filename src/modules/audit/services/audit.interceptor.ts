import { CallHandler, ExecutionContext, Inject, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  @Inject(AuditService) private readonly audit: AuditService;

  public intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const isHttp = context.getType() === 'http';
    if (!isHttp) return next.handle();

    const http = context.switchToHttp();
    const req = http.getRequest<Request & { user?: any }>();

    const method = (req.method || '').toUpperCase();
    // Only audit mutating methods
    const shouldAudit = method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
    if (!shouldAudit) return next.handle();

    const path = (req as any).url || '';
    const isUuid = (v: unknown): v is string =>
      typeof v === 'string' &&
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(v);
    const rawUserId = (req as any).user?.id ?? (req as any).user?.sub ?? (req as any).user?.userId ?? null;
    const userId = isUuid(rawUserId) ? rawUserId : null;
    const tenantId = ((req as any).user?.tenantId ?? (req as any).headers?.['x-tenant-id'] ?? null) || null;
    const entity = this.inferEntityFromPath(path);
    const entityId = (req as any).params?.id ?? null;
    const after = this.safeJsonish((req as any).body ?? null, 10_000);

    const start = Date.now();
    return next.handle().pipe(
      tap(async (data) => {
        try {
          await this.audit.log({ method, path, userId, tenantId, entity, entityId, before: null, after });
        } catch (e) {
          // Best-effort auditing; never fail the request
          this.logger.warn(`Audit persist failed: ${String((e as Error).message)}`);
        } finally {
          const dur = Date.now() - start;
          this.logger.debug(`Audited ${method} ${path} in ${dur}ms`);
        }
      }),
    );
  }

  private inferEntityFromPath(path: string): string | null {
    // e.g., /v1/properties/123 -> properties
    const m = path.match(/^\/?v\d+\/([^\/]+)/) || path.match(/^\/([^\/]+)/);
    return m?.[1] ?? null;
  }

  // es-AR: Sanitiza payloads para jsonb evitando referencias circulares/streams y limitando tamaño
  private safeJsonish(value: unknown, maxBytes: number): unknown {
    if (value == null) return null;
    const seen = new WeakSet<object>();
    const replacer = (_key: string, val: any) => {
      if (!val) return val;
      if (typeof val === 'object') {
        // Buffers
        if (typeof Buffer !== 'undefined' && Buffer.isBuffer(val)) {
          return { type: 'Buffer', length: val.length };
        }
        // Streams / sockets (heurística)
        if (typeof val.pipe === 'function' || val.readable || val.writable) {
          return '[stream]';
        }
        if (val instanceof Date) return val.toISOString();
        if (seen.has(val)) return '[circular]';
        seen.add(val);
      }
      if (typeof val === 'function') return `[function ${val.name || 'anonymous'}]`;
      return val;
    };
    try {
      const json = JSON.stringify(value as any, replacer);
      if (!json) return null;
      if (json.length > maxBytes) {
        return { truncated: true, size: json.length, preview: json.slice(0, maxBytes) };
      }
      return JSON.parse(json);
    } catch {
      return null;
    }
  }
}
