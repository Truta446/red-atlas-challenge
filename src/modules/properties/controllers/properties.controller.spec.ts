import { CacheInterceptor } from '@nestjs/cache-manager';
import { Test, TestingModule } from '@nestjs/testing';

import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { QueryPropertiesDto } from '../dto/query-properties.dto';
import { PropertiesService } from '../services/properties.service';
import { PropertiesController } from './properties.controller';

describe('PropertiesController', () => {
  let controller: PropertiesController;
  let service: jest.Mocked<PropertiesService>;

  const tenantUser = { userId: 'u1', email: 'x@y.com', role: 'admin', tenantId: 'tenant-a' } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PropertiesController],
      providers: [
        {
          provide: PropertiesService,
          useValue: {
            findMany: jest.fn(),
            create: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            softDelete: jest.fn(),
            restore: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: jest.fn().mockResolvedValue(true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn().mockResolvedValue(true) })
      .overrideInterceptor(CacheInterceptor)
      .useValue({ intercept: (_ctx: any, next: any) => next.handle() })
      .compile();

    controller = module.get(PropertiesController);
    service = module.get(PropertiesService);
  });

  it('list forwards query and tenant', async () => {
    const query: QueryPropertiesDto = { sector: 'Moema', limit: 10 } as any;
    (service.findMany as any).mockResolvedValue({ items: [], nextCursor: null });
    const res = await controller.list(query, tenantUser);
    expect(service.findMany).toHaveBeenCalledWith(query, tenantUser.tenantId);
    expect(res).toEqual({ items: [], nextCursor: null });
  });

  it('create forwards dto and tenant', async () => {
    const dto = { address: 'A', sector: 'S', type: 'T', price: '100000', latitude: 1, longitude: 2 } as any;
    (service.create as any).mockResolvedValue({ id: 'P1' });
    const res = await controller.create(dto, tenantUser);
    expect(service.create).toHaveBeenCalledWith(dto, tenantUser.tenantId);
    expect(res).toEqual({ id: 'P1' });
  });

  it('getById forwards id and tenant', async () => {
    (service.findOne as any).mockResolvedValue({ id: 'P1' });
    const res = await controller.getById('P1', tenantUser);
    expect(service.findOne).toHaveBeenCalledWith('P1', tenantUser.tenantId);
    expect(res).toEqual({ id: 'P1' });
  });

  it('update forwards id, dto and tenant', async () => {
    const dto = { address: 'B' } as any;
    (service.update as any).mockResolvedValue({ id: 'P1', address: 'B' });
    const res = await controller.update('P1', dto, tenantUser);
    expect(service.update).toHaveBeenCalledWith('P1', dto, tenantUser.tenantId);
    expect(res).toEqual({ id: 'P1', address: 'B' });
  });

  it('softDelete forwards id and tenant', async () => {
    (service.softDelete as any).mockResolvedValue(undefined);
    await controller.softDelete('P1', tenantUser);
    expect(service.softDelete).toHaveBeenCalledWith('P1', tenantUser.tenantId);
  });

  it('restore forwards id and tenant', async () => {
    (service.restore as any).mockResolvedValue({ id: 'P1' });
    const res = await controller.restore('P1', tenantUser);
    expect(service.restore).toHaveBeenCalledWith('P1', tenantUser.tenantId);
    expect(res).toEqual({ id: 'P1' });
  });

  it('list throws when CurrentUser is missing', async () => {
    await expect(controller.list({} as any, undefined as any)).rejects.toThrow();
    expect(service.findMany).not.toHaveBeenCalled();
  });

  it('create throws when CurrentUser is missing', async () => {
    await expect(controller.create({} as any, undefined as any)).rejects.toThrow();
    expect(service.create).not.toHaveBeenCalled();
  });

  it('getById throws when CurrentUser is missing', async () => {
    await expect(controller.getById('P1', undefined as any)).rejects.toThrow();
    expect(service.findOne).not.toHaveBeenCalled();
  });

  it('update throws when CurrentUser is missing', async () => {
    await expect(controller.update('P1', {} as any, undefined as any)).rejects.toThrow();
    expect(service.update).not.toHaveBeenCalled();
  });

  it('softDelete throws when CurrentUser is missing', async () => {
    await expect(controller.softDelete('P1', undefined as any)).rejects.toThrow();
    expect(service.softDelete).not.toHaveBeenCalled();
  });

  it('restore throws when CurrentUser is missing', async () => {
    await expect(controller.restore('P1', undefined as any)).rejects.toThrow();
    expect(service.restore).not.toHaveBeenCalled();
  });
});
