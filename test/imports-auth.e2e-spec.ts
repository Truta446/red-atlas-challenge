import { INestApplication, VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AuthGuard } from '../src/modules/auth/guards/auth.guard';
import { ImportsController } from '../src/modules/imports/controllers/imports.controller';
import { ImportsService } from '../src/modules/imports/services/imports.service';

const denyAuthGuard = { canActivate: () => false };

const mockImportsService: Partial<ImportsService> = {
  async enqueueImport() {
    return { id: 'job-1', status: 'processing' } as any;
  },
} as any;

describe('Imports auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const builder = Test.createTestingModule({
      controllers: [ImportsController],
      providers: [{ provide: ImportsService, useValue: mockImportsService }],
    })
      .overrideGuard(AuthGuard)
      .useValue(denyAuthGuard);

    const moduleFixture: TestingModule = await builder.compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /v1/imports should be forbidden when not authenticated', async () => {
    await request(app.getHttpServer())
      .post('/v1/imports')
      .set('Idempotency-Key', 'abc')
      .set('Content-Type', 'text/csv')
      .send('address,sector,type,price,latitude,longitude\nA,S,house,100,1,1\n')
      .expect(403);
  });
});
