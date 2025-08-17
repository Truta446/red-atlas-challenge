import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Listing } from '../../listings/entities/listing.entity';
import { Property } from '../../properties/entities/property.entity';
import { Transaction } from '../entities/transaction.entity';
import { TransactionsService } from '../services/transactions.service';

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

  it('findMany applies filters and asc ordering', async () => {
    const qb = createQB({});
    qb.getMany.mockResolvedValue([{ id: 'id1' }, { id: 'id2' }] as any);
    (txRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

    await service.findMany(
      {
        propertyId: 'p1',
        listingId: 'l1',
        minPrice: 10,
        maxPrice: 20,
        fromDate: '2025-01-01',
        toDate: '2025-12-31',
        order: 'asc',
        limit: 2,
      } as any,
      tenantId,
    );

    const clauses = qb.andWhere.mock.calls.map((c: any[]) => c[0]);
    expect(clauses.some((s: string) => s.includes('p.id = :pid'))).toBe(true);
    expect(clauses.some((s: string) => s.includes('l.id = :lid'))).toBe(true);
    expect(clauses.some((s: string) => s.includes('t.price >= :min'))).toBe(true);
    expect(clauses.some((s: string) => s.includes('t.price <= :max'))).toBe(true);
    expect(clauses.some((s: string) => s.includes('t.date >= :from'))).toBe(true);
    expect(clauses.some((s: string) => s.includes('t.date <= :to'))).toBe(true);
    expect(qb.addOrderBy).toHaveBeenCalledWith('t.date', 'ASC');
  });

  it('creates a transaction when listingId is not provided (skips listing lookup)', async () => {
    propRepo.findOne.mockResolvedValue({ id: 'prop1', tenantId } as any);
    // ensure listing is not called
    const listSpy = jest.spyOn(listRepo, 'findOne');

    const qb = createQB();
    qb.execute.mockResolvedValue({ identifiers: [{ id: 'tx2' }], raw: [{ id: 'tx2' }] });
    (txRepo.createQueryBuilder as jest.Mock).mockReturnValue({
      insert: qb.insert,
      into: qb.into,
      values: qb.values,
      returning: qb.returning,
      execute: qb.execute,
    });

    (txRepo.findOne as any) = jest.fn().mockResolvedValue({ id: 'tx2', tenantId } as any);
    const created = await service.create({ propertyId: 'prop1', price: 100, date: '2025-01-01' } as any, tenantId);
    expect(created.id).toBe('tx2');
    expect(listSpy).not.toHaveBeenCalled();
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

  it('findMany applies cursor filter when valid cursor provided', async () => {
    const qb = createQB({});
    qb.getMany.mockResolvedValue([{ id: 'id2' }] as any);
    (txRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

    const uuid = '123e4567-e89b-12d3-a456-426614174000';
    const cursor = Buffer.from(uuid, 'utf8').toString('base64url');
    await service.findMany({ cursor, limit: 1 } as any, tenantId);
    const hasAfter = qb.andWhere.mock.calls.some(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('t.id > :afterId'),
    );
    expect(hasAfter).toBe(true);
  });

  it('findMany ignores invalid cursor', async () => {
    const qb = createQB({});
    qb.getMany.mockResolvedValue([{ id: 'id1' }] as any);
    (txRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

    await service.findMany({ cursor: 'not-base64url', limit: 1 } as any, tenantId);
    const hasAfter = qb.andWhere.mock.calls.some(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('t.id > :afterId'),
    );
    expect(hasAfter).toBe(false);
  });
});
