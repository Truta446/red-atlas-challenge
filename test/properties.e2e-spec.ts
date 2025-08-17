import { CacheInterceptor } from '@nestjs/cache-manager';
import { CallHandler, ExecutionContext, INestApplication, VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AuthGuard } from '../src/modules/auth/guards/auth.guard';
import { RolesGuard } from '../src/modules/auth/guards/roles.guard';
import { PropertiesController } from '../src/modules/properties/controllers/properties.controller';
import { Property } from '../src/modules/properties/entities/property.entity';
import { PropertiesService } from '../src/modules/properties/services/properties.service';

// Mocks
const allowAuthGuard = {
  canActivate: (context: any) => {
    const req = context.switchToHttp().getRequest();
    // inject a fake user for CurrentUser decorator
    req.user = { id: 'u1', tenantId: 't1', roles: ['admin'] };
    return true;
  },
};
const allowRolesGuard = { canActivate: () => true };

const mockPropertiesService: Partial<PropertiesService> = {
  async findMany() {
    return { items: [{ id: 'p1' } as Property], nextCursor: null };
  },
  async create(dto: any) {
    return { id: 'p2', ...dto } as Property;
  },
};

describe('Properties (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const builder = Test.createTestingModule({
      controllers: [PropertiesController],
      providers: [{ provide: PropertiesService, useValue: mockPropertiesService }],
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

  it('GET /v1/properties should return items', async () => {
    const res = await request(app.getHttpServer()).get('/v1/properties').expect(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items[0].id).toBe('p1');
  });

  it('POST /v1/properties should create', async () => {
    const payload = { address: 'A', sector: 'S', type: 'house', price: 100, latitude: 1, longitude: 1 };
    const res = await request(app.getHttpServer()).post('/v1/properties').send(payload).expect(201);
    expect(res.body.id).toBe('p2');
    expect(res.body.address).toBe('A');
  });
});
