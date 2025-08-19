import { CacheInterceptor } from '@nestjs/cache-manager';
import { CallHandler, ExecutionContext, INestApplication, VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AuthGuard } from '../src/modules/auth/guards/auth.guard';
import { RolesGuard } from '../src/modules/auth/guards/roles.guard';
import { PropertiesController } from '../src/modules/properties/controllers/properties.controller';
import { PropertiesService } from '../src/modules/properties/services/properties.service';

const denyAuthGuard = { canActivate: () => false };
const allowRolesGuard = { canActivate: () => true };

const mockPropertiesService: Partial<PropertiesService> = {
  async findMany() {
    return { items: [], nextCursor: null } as any;
  },
} as any;

describe('Properties auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const builder = Test.createTestingModule({
      controllers: [PropertiesController],
      providers: [{ provide: PropertiesService, useValue: mockPropertiesService }],
    })
      .overrideGuard(AuthGuard)
      .useValue(denyAuthGuard)
      .overrideGuard(RolesGuard)
      .useValue(allowRolesGuard)
      .overrideInterceptor(CacheInterceptor)
      .useValue({
        intercept: (_context: ExecutionContext, next: CallHandler) => next.handle(),
      });

    const moduleFixture: TestingModule = await builder.compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /v1/properties should be forbidden when not authenticated', async () => {
    await request(app.getHttpServer()).get('/v1/properties').expect(403);
  });
});
