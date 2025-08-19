import { CacheInterceptor } from '@nestjs/cache-manager';
import { CallHandler, ExecutionContext, INestApplication, VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AuthGuard } from '../src/modules/auth/guards/auth.guard';
import { RolesGuard } from '../src/modules/auth/guards/roles.guard';
import { TransactionsController } from '../src/modules/transactions/controllers/transactions.controller';
import { TransactionsService } from '../src/modules/transactions/services/transactions.service';

const denyAuthGuard = { canActivate: () => false };
const allowRolesGuard = { canActivate: () => true };

const mockService: Partial<TransactionsService> = {
  async findMany() {
    return { items: [], nextCursor: null } as any;
  },
} as any;

describe('Transactions auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const builder = Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [{ provide: TransactionsService, useValue: mockService }],
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

  it('GET /v1/transactions should be forbidden when not authenticated', async () => {
    await request(app.getHttpServer()).get('/v1/transactions').expect(403);
  });
});
