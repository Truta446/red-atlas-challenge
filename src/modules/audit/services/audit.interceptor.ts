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
    const userId = (req as any).user?.id ?? null;
    const tenantId = (req as any).user?.tenantId ?? (req as any).headers?.['x-tenant-id'] ?? null;
    const entity = this.inferEntityFromPath(path);
    const entityId = (req as any).params?.id ?? null;
    const after = (req as any).body ?? null;

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
}
