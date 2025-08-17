import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ListingsService } from './listings.service';
import { Listing } from './listing.entity';
import { Property } from '../properties/property.entity';

// Minimal chainable query builder mock helper
function createQB<T>(overrides: Partial<Record<string, any>> = {}) {
  const state: any = {
    values: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    execute: jest.fn(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };
  return { ...state, ...overrides } as any;
}

describe('ListingsService', () => {
  let service: ListingsService;
  let listingRepo: jest.Mocked<Repository<Listing>>;
  let propRepo: jest.Mocked<Repository<Property>>;

  const tenantId = 'tenant-a';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListingsService,
        { provide: getRepositoryToken(Listing), useValue: {
          createQueryBuilder: jest.fn(),
          findOne: jest.fn(),
          update: jest.fn(),
          softDelete: jest.fn(),
          restore: jest.fn(),
        } },
        { provide: getRepositoryToken(Property), useValue: {
          findOne: jest.fn(),
        } },
      ],
    }).compile();

    service = module.get(ListingsService);
    listingRepo = module.get(getRepositoryToken(Listing));
    propRepo = module.get(getRepositoryToken(Property));
  });

  it('creates a listing when property belongs to tenant', async () => {
    propRepo.findOne.mockResolvedValue({ id: 'prop1', tenantId } as any);

    const qb = createQB();
    qb.execute.mockResolvedValue({ identifiers: [{ id: 'list1' }], raw: [{ id: 'list1' }] });
    (listingRepo.createQueryBuilder as jest.Mock).mockReturnValue({
      insert: qb.insert,
      into: qb.into,
      values: qb.values,
      returning: qb.returning,
      execute: qb.execute,
    });

    listingRepo.findOne = jest.fn().mockResolvedValue({ id: 'list1', tenantId } as any);

    const created = await service.create({ propertyId: 'prop1', status: 'active', price: 123 } as any, tenantId);
    expect(created).toEqual(expect.objectContaining({ id: 'list1' }));
    expect(propRepo.findOne).toHaveBeenCalledWith({ where: { id: 'prop1', tenantId } });
  });

  it('throws on create if property not found for tenant', async () => {
    propRepo.findOne.mockResolvedValue(null);
    await expect(
      service.create({ propertyId: 'pX', status: 'active', price: 10 } as any, tenantId),
    ).rejects.toThrow('Property not found for tenant');
  });

  it('findOne returns entity for tenant', async () => {
    (listingRepo.findOne as any) = jest.fn().mockResolvedValue({ id: 'A', tenantId } as any);
    const res = await service.findOne('A', tenantId);
    expect(res?.id).toBe('A');
  });

  it('update patches fields and returns updated entity', async () => {
    (listingRepo.update as any) = jest.fn().mockResolvedValue({});
    (service.findOne as any) = jest.fn().mockResolvedValue({ id: 'A', status: 'inactive', price: 200 } as any);
    const res = await service.update('A', { status: 'active', price: 300 } as any, tenantId);
    expect(listingRepo.update).toHaveBeenCalledWith({ id: 'A', tenantId }, expect.objectContaining({ status: 'active', price: 300 }));
    expect(res).toBeTruthy();
  });

  it('softDelete delegates to repository', async () => {
    (listingRepo.softDelete as any) = jest.fn().mockResolvedValue({});
    await service.softDelete('A', tenantId);
    expect(listingRepo.softDelete).toHaveBeenCalledWith({ id: 'A', tenantId });
  });

  it('restore restores entity and returns it', async () => {
    (listingRepo.restore as any) = jest.fn().mockResolvedValue({});
    (service.findOne as any) = jest.fn().mockResolvedValue({ id: 'A' } as any);
    const res = await service.restore('A', tenantId);
    expect(listingRepo.restore).toHaveBeenCalledWith({ id: 'A', tenantId });
    expect(res?.id).toBe('A');
  });

  it('findMany builds query and returns items with nextCursor', async () => {
    const qb = createQB({});
    const rows = Array.from({ length: 3 }).map((_, i) => ({ id: `id${i+1}` } as any));
    qb.getMany.mockResolvedValue(rows);
    (listingRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

    const res = await service.findMany({ limit: 2, order: 'desc' } as any, tenantId);
    expect(res.items.length).toBe(2);
    expect(res.nextCursor).toBeTruthy();
  });
});
