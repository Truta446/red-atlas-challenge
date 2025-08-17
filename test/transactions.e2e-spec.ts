import { CacheInterceptor } from '@nestjs/cache-manager';
import { CallHandler, ExecutionContext, INestApplication, VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AuthGuard } from '../src/modules/auth/guards/auth.guard';
import { RolesGuard } from '../src/modules/auth/guards/roles.guard';
import { TransactionsController } from '../src/modules/transactions/controllers/transactions.controller';
import type { Transaction } from '../src/modules/transactions/entities/transaction.entity';
import { TransactionsService } from '../src/modules/transactions/services/transactions.service';

const allowAuthGuard = {
  canActivate: (context: any) => {
    const req = context.switchToHttp().getRequest();
    req.user = { id: 'u1', tenantId: 't1', roles: ['admin'] };
    return true;
  },
};
const allowRolesGuard = { canActivate: () => true };

const mockTransactionsService: Partial<TransactionsService> = {
  async findMany() {
    return { items: [{ id: 'tx1' } as Transaction], nextCursor: null };
  },
  async create(dto: any) {
    return { id: 'tx2', ...dto } as Transaction;
  },
  async findOne(id: string) {
    return { id } as Transaction;
  },
  async update(id: string, dto: any) {
    return { id, ...dto } as Transaction;
  },
  async softDelete() {
    return;
  },
  async restore(id: string) {
    return { id } as Transaction;
  },
};

describe('Transactions (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const builder = Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [{ provide: TransactionsService, useValue: mockTransactionsService }],
    })
      .overrideGuard(AuthGuard)
      .useValue(allowAuthGuard)
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

  it('GET /v1/transactions should return items', async () => {
    const res = await request(app.getHttpServer()).get('/v1/transactions').expect(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items[0].id).toBe('tx1');
  });

  it('POST /v1/transactions should create', async () => {
    const payload = { amount: 100, currency: 'BRL' };
    const res = await request(app.getHttpServer()).post('/v1/transactions').send(payload).expect(201);
    expect(res.body.id).toBe('tx2');
    expect(res.body.amount).toBe(100);
  });

  it('GET /v1/transactions/:id should return one', async () => {
    const res = await request(app.getHttpServer()).get('/v1/transactions/tx1').expect(200);
    expect(res.body.id).toBe('tx1');
  });

  it('PATCH /v1/transactions/:id should update', async () => {
    const res = await request(app.getHttpServer()).patch('/v1/transactions/tx1').send({ note: 'Updated' }).expect(200);
    expect(res.body.id).toBe('tx1');
    expect(res.body.note).toBe('Updated');
  });

  it('DELETE /v1/transactions/:id should soft delete', async () => {
    await request(app.getHttpServer()).delete('/v1/transactions/tx1').expect(204);
  });

  it('PATCH /v1/transactions/:id/restore should restore', async () => {
    const res = await request(app.getHttpServer()).patch('/v1/transactions/tx1/restore').expect(200);
    expect(res.body.id).toBe('tx1');
  });
});
