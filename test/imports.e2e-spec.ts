import { INestApplication, VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AuthGuard } from '../src/modules/auth/auth.guard';
import { ImportsService } from '../src/modules/imports/imports.service';
import { ImportJob } from '../src/modules/imports/import-job.entity';
import { ImportsController } from '../src/modules/imports/imports.controller';

const allowAuthGuard = {
  canActivate: (context: any) => {
    const req = context.switchToHttp().getRequest();
    req.user = { id: 'u1', tenantId: 't1', roles: ['admin'] };
    return true;
  },
};

const job: ImportJob = {
  id: 'job-1',
  tenantId: 't1',
  idempotencyKey: 'key-1',
  status: 'processing',
  processed: 0,
  succeeded: 0,
  failed: 0,
  totalEstimated: 0,
  published: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  error: null,
};

const mockImportsService: Partial<ImportsService> = {
  async enqueueImport(tenantId: string, key: string) {
    return { ...job, idempotencyKey: key, tenantId } as ImportJob;
  },
  async getJob(tenantId: string, id: string) {
    return { ...job, id, tenantId } as ImportJob;
  },
};

describe('Imports (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const builder = Test.createTestingModule({
      controllers: [ImportsController],
      providers: [{ provide: ImportsService, useValue: mockImportsService }],
    }).overrideGuard(AuthGuard)
      .useValue(allowAuthGuard);

    const moduleFixture: TestingModule = await builder.compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /v1/imports should reject when missing Idempotency-Key', async () => {
    await request(app.getHttpServer())
      .post('/v1/imports')
      .set('Content-Type', 'text/csv')
      .send('address,sector,type,price,latitude,longitude\nA,S,house,100,1,1\n')
      .expect(400);
  });

  it('POST /v1/imports should reject when content-type is not text/csv', async () => {
    await request(app.getHttpServer())
      .post('/v1/imports')
      .set('Idempotency-Key', 'abc')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({}))
      .expect(415);
  });

  it('POST /v1/imports should accept CSV with proper headers', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/imports')
      .set('Idempotency-Key', 'abc')
      .set('Content-Type', 'text/csv')
      .send('address,sector,type,price,latitude,longitude\nA,S,house,100,1,1\n')
      .expect(202);

    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('status', 'processing');
  });

  it('GET /v1/imports/:id should return job', async () => {
    const res = await request(app.getHttpServer()).get('/v1/imports/job-xyz').expect(200);
    expect(res.body).toHaveProperty('id', 'job-xyz');
  });
});
