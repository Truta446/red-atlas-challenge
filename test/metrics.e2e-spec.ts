import { INestApplication, VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AuthGuard } from '../src/modules/auth/guards/auth.guard';
import { MetricsController } from '../src/modules/metrics/controllers/metrics.controller';
import { MetricsService } from '../src/modules/metrics/services/metrics.service';

const allowAuthGuard = {
  canActivate: (context: any) => {
    const req = context.switchToHttp().getRequest();
    req.user = { id: 'u1', tenantId: 't1', roles: ['admin'] };
    return true;
  },
};

const mockMetricsService: Partial<MetricsService> = {
  registry: {
    metrics: async () => '# TYPE up gauge\nup 1\n',
  } as any,
};

describe('Metrics (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const builder = Test.createTestingModule({
      controllers: [MetricsController],
      providers: [{ provide: MetricsService, useValue: mockMetricsService }],
    })
      .overrideGuard(AuthGuard)
      .useValue(allowAuthGuard);

    const moduleFixture: TestingModule = await builder.compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /v1/metrics should return text/plain', async () => {
    const res = await request(app.getHttpServer()).get('/v1/metrics').expect(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.text).toContain('# TYPE up gauge');
  });
});
