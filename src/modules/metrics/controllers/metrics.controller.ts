import { Controller, Get, Header, Inject, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { AuthGuard } from '../../auth/guards/auth.guard';
import { MetricsService } from '../services/metrics.service';

@ApiTags('metrics')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ path: 'metrics', version: '1' })
export class MetricsController {
  @Inject(MetricsService) private readonly metrics: MetricsService;

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4')
  public async getMetrics(): Promise<string> {
    return this.metrics.registry.metrics();
  }
}
