import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionsService } from './transactions.service';
import { Transaction } from './transaction.entity';
import { Property } from '../properties/property.entity';
import { Listing } from '../listings/listing.entity';

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

describe('TransactionsService', () => {
  let service: TransactionsService;
  let txRepo: jest.Mocked<Repository<Transaction>>;
  let propRepo: jest.Mocked<Repository<Property>>;
  let listRepo: jest.Mocked<Repository<Listing>>;

  const tenantId = 'tenant-a';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: {
            createQueryBuilder: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            softDelete: jest.fn(),
            restore: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Property),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Listing),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(TransactionsService);
    txRepo = module.get(getRepositoryToken(Transaction));
    propRepo = module.get(getRepositoryToken(Property));
    listRepo = module.get(getRepositoryToken(Listing));
  });

  it('creates a transaction when property (and listing if provided) belong to tenant', async () => {
    propRepo.findOne.mockResolvedValue({ id: 'prop1', tenantId } as any);
    listRepo.findOne.mockResolvedValue({ id: 'list1', tenantId } as any);

    const qb = createQB();
    qb.execute.mockResolvedValue({ identifiers: [{ id: 'tx1' }], raw: [{ id: 'tx1' }] });
    (txRepo.createQueryBuilder as jest.Mock).mockReturnValue({
      insert: qb.insert,
      into: qb.into,
      values: qb.values,
      returning: qb.returning,
      execute: qb.execute,
    });

    txRepo.findOne = jest.fn().mockResolvedValue({ id: 'tx1', tenantId } as any);

    const created = await service.create(
      { propertyId: 'prop1', listingId: 'list1', price: 500, date: '2025-01-01' } as any,
      tenantId,
    );
    expect(created).toEqual(expect.objectContaining({ id: 'tx1' }));
    expect(propRepo.findOne).toHaveBeenCalledWith({ where: { id: 'prop1', tenantId } });
    expect(listRepo.findOne).toHaveBeenCalledWith({ where: { id: 'list1', tenantId } });
  });

  it('throws on create if property not found for tenant', async () => {
    propRepo.findOne.mockResolvedValue(null);
    await expect(service.create({ propertyId: 'nope', price: 1, date: '2025-01-01' } as any, tenantId)).rejects.toThrow(
      'Property not found for tenant',
    );
  });

  it('throws on create if listing provided but not found for tenant', async () => {
    propRepo.findOne.mockResolvedValue({ id: 'prop1', tenantId } as any);
    listRepo.findOne.mockResolvedValue(null as any);
    await expect(
      service.create({ propertyId: 'prop1', listingId: 'nope', price: 1, date: '2025-01-01' } as any, tenantId),
    ).rejects.toThrow('Listing not found for tenant');
  });

  it('findOne returns entity for tenant', async () => {
    (txRepo.findOne as any) = jest.fn().mockResolvedValue({ id: 'A', tenantId } as any);
    const res = await service.findOne('A', tenantId);
    expect(res?.id).toBe('A');
  });

  it('update patches fields and returns updated entity', async () => {
    (txRepo.update as any) = jest.fn().mockResolvedValue({});
    (service.findOne as any) = jest.fn().mockResolvedValue({ id: 'A', price: 1 } as any);
    const res = await service.update('A', { price: 300, date: '2025-02-02' } as any, tenantId);
    expect(txRepo.update).toHaveBeenCalledWith(
      { id: 'A', tenantId },
      expect.objectContaining({ price: 300, date: '2025-02-02' }),
    );
    expect(res).toBeTruthy();
  });

  it('softDelete delegates to repository', async () => {
    (txRepo.softDelete as any) = jest.fn().mockResolvedValue({});
    await service.softDelete('A', tenantId);
    expect(txRepo.softDelete).toHaveBeenCalledWith({ id: 'A', tenantId });
  });

  it('restore restores entity and returns it', async () => {
    (txRepo.restore as any) = jest.fn().mockResolvedValue({});
    (service.findOne as any) = jest.fn().mockResolvedValue({ id: 'A' } as any);
    const res = await service.restore('A', tenantId);
    expect(txRepo.restore).toHaveBeenCalledWith({ id: 'A', tenantId });
    expect(res?.id).toBe('A');
  });

  it('findMany builds query and returns items with nextCursor', async () => {
    const qb = createQB({});
    const rows = Array.from({ length: 3 }).map((_, i) => ({ id: `id${i + 1}` }) as any);
    qb.getMany.mockResolvedValue(rows);
    (txRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

    const res = await service.findMany({ limit: 2, order: 'desc' } as any, tenantId);
    expect(res.items.length).toBe(2);
    expect(res.nextCursor).toBeTruthy();
  });
});
