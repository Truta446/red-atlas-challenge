import { Test, TestingModule } from '@nestjs/testing';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { AuthGuard } from '../auth/auth.guard';
import { register } from 'prom-client';

describe('MetricsController', () => {
  let controller: MetricsController;
  const metricsMock = {
    registry: { metrics: jest.fn().mockResolvedValue('# HELP ok\n# TYPE counter\n') } as any,
  } as unknown as MetricsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [{ provide: MetricsService, useValue: metricsMock }],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(MetricsController);
  });

  afterAll(() => {
    register.clear();
  });

  it('should return prometheus metrics text', async () => {
    const text = await controller.getMetrics();
    expect(typeof text).toBe('string');
    expect(metricsMock.registry.metrics).toHaveBeenCalled();
  });
});
