import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  @Inject(MetricsService) private readonly metrics: MetricsService;

  public intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') return next.handle();
    const http = context.switchToHttp();
    const req = http.getRequest<any>();
    const res = http.getResponse<any>();

    const end = this.metrics.httpLatency.startTimer({
      method: (req.method || '').toUpperCase(),
      route: req.routerPath || req.url,
    });
    return next.handle().pipe(
      tap(() => {
        const status = res.statusCode || 200;
        end({ status: String(status) });
      }),
    );
  }
}
