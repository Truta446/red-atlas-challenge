import { Test, TestingModule } from '@nestjs/testing';

import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import type { QueryListingsDto } from '../dto/query-listings.dto';
import { ListingsService } from '../services/listings.service';
import { ListingsController } from './listings.controller';

describe('ListingsController', () => {
  let controller: ListingsController;
  let service: jest.Mocked<ListingsService>;

  const tenantUser = { userId: 'u1', email: 'x@y.com', role: 'admin', tenantId: 'tenant-a' } as any;

  beforeEach(async () => {
    const builder = Test.createTestingModule({
      controllers: [ListingsController],
      providers: [
        {
          provide: ListingsService,
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
    });

    const module: TestingModule = await builder
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: jest.fn().mockResolvedValue(true) })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: jest.fn().mockResolvedValue(true) })
      .compile();

    controller = module.get(ListingsController);
    service = module.get(ListingsService);
  });

  it('list forwards query and tenant', async () => {
    const query: QueryListingsDto = { status: 'active', limit: 10 } as any;
    (service.findMany as any).mockResolvedValue({ items: [], nextCursor: null });
    const res = await controller.list(query, tenantUser);
    expect(service.findMany).toHaveBeenCalledWith(query, tenantUser.tenantId);
    expect(res).toEqual({ items: [], nextCursor: null });
  });

  it('create forwards dto and tenant', async () => {
    const dto = { propertyId: 'p1', status: 'active', price: 100 } as any;
    (service.create as any).mockResolvedValue({ id: 'L1' });
    const res = await controller.create(dto, tenantUser);
    expect(service.create).toHaveBeenCalledWith(dto, tenantUser.tenantId);
    expect(res).toEqual({ id: 'L1' });
  });

  it('getById forwards id and tenant', async () => {
    (service.findOne as any).mockResolvedValue({ id: 'L1' });
    const res = await controller.getById('L1', tenantUser);
    expect(service.findOne).toHaveBeenCalledWith('L1', tenantUser.tenantId);
    expect(res).toEqual({ id: 'L1' });
  });

  it('update forwards id, dto and tenant', async () => {
    const dto = { status: 'inactive' } as any;
    (service.update as any).mockResolvedValue({ id: 'L1', status: 'inactive' });
    const res = await controller.update('L1', dto, tenantUser);
    expect(service.update).toHaveBeenCalledWith('L1', dto, tenantUser.tenantId);
    expect(res).toEqual({ id: 'L1', status: 'inactive' });
  });

  it('softDelete forwards id and tenant', async () => {
    (service.softDelete as any).mockResolvedValue(undefined);
    await controller.softDelete('L1', tenantUser);
    expect(service.softDelete).toHaveBeenCalledWith('L1', tenantUser.tenantId);
  });

  it('restore forwards id and tenant', async () => {
    (service.restore as any).mockResolvedValue({ id: 'L1' });
    const res = await controller.restore('L1', tenantUser);
    expect(service.restore).toHaveBeenCalledWith('L1', tenantUser.tenantId);
    expect(res).toEqual({ id: 'L1' });
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
    await expect(controller.getById('L1', undefined as any)).rejects.toThrow();
    expect(service.findOne).not.toHaveBeenCalled();
  });

  it('update throws when CurrentUser is missing', async () => {
    await expect(controller.update('L1', {} as any, undefined as any)).rejects.toThrow();
    expect(service.update).not.toHaveBeenCalled();
  });

  it('softDelete throws when CurrentUser is missing', async () => {
    await expect(controller.softDelete('L1', undefined as any)).rejects.toThrow();
    expect(service.softDelete).not.toHaveBeenCalled();
  });

  it('restore throws when CurrentUser is missing', async () => {
    await expect(controller.restore('L1', undefined as any)).rejects.toThrow();
    expect(service.restore).not.toHaveBeenCalled();
  });
});
