import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import type { QueryTransactionsDto } from './dto/query-transactions.dto';

describe('TransactionsController', () => {
  let controller: TransactionsController;
  let service: jest.Mocked<TransactionsService>;

  const tenantUser = { userId: 'u1', email: 'x@y.com', role: 'admin', tenantId: 'tenant-a' } as any;

  beforeEach(async () => {
    const builder = Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [
        {
          provide: TransactionsService,
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

    controller = module.get(TransactionsController);
    service = module.get(TransactionsService);
  });

  it('list forwards query and tenant', async () => {
    const query: QueryTransactionsDto = { limit: 10 } as any;
    (service.findMany as any).mockResolvedValue({ items: [], nextCursor: null });
    const res = await controller.list(query, tenantUser);
    expect(service.findMany).toHaveBeenCalledWith(query, tenantUser.tenantId);
    expect(res).toEqual({ items: [], nextCursor: null });
  });

  it('create forwards dto and tenant', async () => {
    const dto = { propertyId: 'p1', price: 100, date: '2025-01-01' } as any;
    (service.create as any).mockResolvedValue({ id: 'T1' });
    const res = await controller.create(dto, tenantUser);
    expect(service.create).toHaveBeenCalledWith(dto, tenantUser.tenantId);
    expect(res).toEqual({ id: 'T1' });
  });

  it('getById forwards id and tenant', async () => {
    (service.findOne as any).mockResolvedValue({ id: 'T1' });
    const res = await controller.getById('T1', tenantUser);
    expect(service.findOne).toHaveBeenCalledWith('T1', tenantUser.tenantId);
    expect(res).toEqual({ id: 'T1' });
  });

  it('update forwards id, dto and tenant', async () => {
    const dto = { price: 300 } as any;
    (service.update as any).mockResolvedValue({ id: 'T1', price: 300 });
    const res = await controller.update('T1', dto, tenantUser);
    expect(service.update).toHaveBeenCalledWith('T1', dto, tenantUser.tenantId);
    expect(res).toEqual({ id: 'T1', price: 300 });
  });

  it('softDelete forwards id and tenant', async () => {
    (service.softDelete as any).mockResolvedValue(undefined);
    await controller.softDelete('T1', tenantUser);
    expect(service.softDelete).toHaveBeenCalledWith('T1', tenantUser.tenantId);
  });

  it('restore forwards id and tenant', async () => {
    (service.restore as any).mockResolvedValue({ id: 'T1' });
    const res = await controller.restore('T1', tenantUser);
    expect(service.restore).toHaveBeenCalledWith('T1', tenantUser.tenantId);
    expect(res).toEqual({ id: 'T1' });
  });
});
