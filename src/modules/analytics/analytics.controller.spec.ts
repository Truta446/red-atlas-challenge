import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AuthGuard } from '../auth/auth.guard';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  const service = {
    distributionBySectorType: jest.fn().mockResolvedValue([]),
    monthlyPercentiles: jest.fn().mockResolvedValue([]),
    sectorYoYValuation: jest.fn().mockResolvedValue([]),
  } as unknown as jest.Mocked<AnalyticsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [{ provide: AnalyticsService, useValue: service }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AnalyticsController);
  });

  it('distribution delegates to service with tenant', async () => {
    const user = { tenantId: 't1' } as any;
    await controller.distribution(user);
    expect(service.distributionBySectorType).toHaveBeenCalledWith('t1');
  });

  it('monthly-percentiles parses months and delegates', async () => {
    const user = { tenantId: 't2' } as any;
    await controller.monthly(user, '6');
    expect(service.monthlyPercentiles).toHaveBeenCalledWith('t2', 6);
  });

  it('sector-yoy parses year and delegates', async () => {
    const user = { tenantId: 't3' } as any;
    await controller.yoy(user, '2024');
    expect(service.sectorYoYValuation).toHaveBeenCalledWith('t3', 2024);
  });
});
