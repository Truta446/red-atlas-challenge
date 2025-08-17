import { INestApplication, VersioningType, CallHandler, ExecutionContext } from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AuthGuard } from '../src/modules/auth/auth.guard';
import { RolesGuard } from '../src/modules/auth/roles.guard';
import { ListingsService } from '../src/modules/listings/listings.service';
import { ListingsController } from '../src/modules/listings/listings.controller';
import type { Listing } from '../src/modules/listings/listing.entity';

// Guards overrides
const allowAuthGuard = {
  canActivate: (context: any) => {
    const req = context.switchToHttp().getRequest();
    req.user = { id: 'u1', tenantId: 't1', roles: ['admin'] };
    return true;
  },
};
const allowRolesGuard = { canActivate: () => true };

const mockListingsService: Partial<ListingsService> = {
  async findMany() {
    return { items: [{ id: 'l1' } as Listing], nextCursor: null };
  },
  async create(dto: any) {
    return { id: 'l2', ...dto } as Listing;
  },
  async findOne(id: string) {
    return { id } as Listing;
  },
  async update(id: string, dto: any) {
    return { id, ...dto } as Listing;
  },
  async softDelete() {
    return;
  },
  async restore(id: string) {
    return { id } as Listing;
  },
};

describe('Listings (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const builder = Test.createTestingModule({
      controllers: [ListingsController],
      providers: [{ provide: ListingsService, useValue: mockListingsService }],
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

  it('GET /v1/listings should return items', async () => {
    const res = await request(app.getHttpServer()).get('/v1/listings').expect(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items[0].id).toBe('l1');
  });

  it('POST /v1/listings should create', async () => {
    const payload = { title: 'Listing A', price: 123 };
    const res = await request(app.getHttpServer()).post('/v1/listings').send(payload).expect(201);
    expect(res.body.id).toBe('l2');
    expect(res.body.title).toBe('Listing A');
  });

  it('GET /v1/listings/:id should return one', async () => {
    const res = await request(app.getHttpServer()).get('/v1/listings/l1').expect(200);
    expect(res.body.id).toBe('l1');
  });

  it('PATCH /v1/listings/:id should update', async () => {
    const res = await request(app.getHttpServer())
      .patch('/v1/listings/l1')
      .send({ title: 'Updated' })
      .expect(200);
    expect(res.body.id).toBe('l1');
    expect(res.body.title).toBe('Updated');
  });

  it('DELETE /v1/listings/:id should soft delete', async () => {
    await request(app.getHttpServer()).delete('/v1/listings/l1').expect(204);
  });

  it('PATCH /v1/listings/:id/restore should restore', async () => {
    const res = await request(app.getHttpServer()).patch('/v1/listings/l1/restore').expect(200);
    expect(res.body.id).toBe('l1');
  });
});
