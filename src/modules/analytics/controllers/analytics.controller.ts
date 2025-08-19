import { Controller, Get, HttpCode, Inject, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { AnalyticsService } from '../services/analytics.service';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ path: 'analytics', version: '1' })
export class AnalyticsController {
  @Inject(AnalyticsService) private readonly analytics: AnalyticsService;

  @Get('distribution')
  @HttpCode(200)
  public distribution(@CurrentUser() user: { tenantId: string }) {
    return this.analytics.distributionBySectorType(user.tenantId);
  }

  @Get('monthly-percentiles')
  @ApiQuery({ name: 'months', required: false, type: Number, description: 'How many months back (default 12)' })
  public monthly(@CurrentUser() user: { tenantId: string }, @Query('months') months?: string) {
    const m = Number(months || 12);
    return this.analytics.monthlyPercentiles(user.tenantId, Number.isFinite(m) && m > 0 ? m : 12);
  }

  @Get('sector-yoy')
  @ApiQuery({ name: 'year', required: false, type: Number, description: 'Target year (default current year)' })
  public yoy(@CurrentUser() user: { tenantId: string }, @Query('year') year?: string) {
    const y = year ? Number(year) : undefined;
    return this.analytics.sectorYoYValuation(user.tenantId, Number.isFinite(y as number) ? (y as number) : undefined);
  }
}
