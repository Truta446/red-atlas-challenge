import { CacheInterceptor } from '@nestjs/cache-manager';
import { CallHandler, ExecutionContext, INestApplication, VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AuthGuard } from '../src/modules/auth/guards/auth.guard';
import { RolesGuard } from '../src/modules/auth/guards/roles.guard';
import { ListingsController } from '../src/modules/listings/controllers/listings.controller';
import { ListingsService } from '../src/modules/listings/services/listings.service';

const denyAuthGuard = { canActivate: () => false };
const allowRolesGuard = { canActivate: () => true };

// Minimal mock service (won't be hit due to guard denial)
const mockListingsService: Partial<ListingsService> = {
  async findMany() {
    return { items: [], nextCursor: null } as any;
  },
} as any;

describe('Listings auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const builder = Test.createTestingModule({
      controllers: [ListingsController],
      providers: [{ provide: ListingsService, useValue: mockListingsService }],
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

  it('GET /v1/listings should be forbidden when not authenticated', async () => {
    await request(app.getHttpServer()).get('/v1/listings').expect(403);
  });
});
