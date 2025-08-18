import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Property } from '../../properties/entities/property.entity';
import { Listing } from '../entities/listing.entity';
import { ListingsService } from '../services/listings.service';

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
    setParameters: jest.fn().mockReturnThis(),
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
        {
          provide: getRepositoryToken(Listing),
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
      ],
    }).compile();

    service = module.get(ListingsService);
    listingRepo = module.get(getRepositoryToken(Listing));
    propRepo = module.get(getRepositoryToken(Property));
  });

  it('findMany applies filters and asc ordering', async () => {
    const qb = createQB({});
    qb.getMany.mockResolvedValue([{ id: 'id1' }, { id: 'id2' }] as any);
    (listingRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

    await service.findMany(
      { status: 'active', propertyId: 'prop1', minPrice: 10, maxPrice: 20, order: 'asc', limit: 2 } as any,
      tenantId,
    );

    // Filters
    const ands = qb.andWhere.mock.calls.map((c: any[]) => c[0]);
    expect(ands.some((s: string) => s.includes('l.status = :status'))).toBe(true);
    expect(ands.some((s: string) => s.includes('p.id = :pid'))).toBe(true);
    expect(ands.some((s: string) => s.includes('l.price >= :min'))).toBe(true);
    expect(ands.some((s: string) => s.includes('l.price <= :max'))).toBe(true);
    // Asc ordering
    expect(qb.addOrderBy).toHaveBeenCalledWith('l.createdAt', 'ASC');
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
    await expect(service.create({ propertyId: 'pX', status: 'active', price: 10 } as any, tenantId)).rejects.toThrow(
      'Property not found for tenant',
    );
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
    expect(listingRepo.update).toHaveBeenCalledWith(
      { id: 'A', tenantId },
      expect.objectContaining({ status: 'active', price: 300 }),
    );
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
    const rows = Array.from({ length: 3 }).map((_, i) => ({ id: `id${i + 1}` }) as any);
    qb.getMany.mockResolvedValue(rows);
    (listingRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

    const res = await service.findMany({ limit: 2, order: 'desc' } as any, tenantId);
    expect(res.items.length).toBe(2);
    expect(res.nextCursor).toBeTruthy();
  });

  it('findMany applies cursor filter when valid cursor provided', async () => {
    const qb = createQB({});
    qb.getMany.mockResolvedValue([{ id: 'id2' }] as any);
    (listingRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

    const uuid = '123e4567-e89b-12d3-a456-426614174000';
    const cursor = Buffer.from(uuid, 'utf8').toString('base64url');
    await service.findMany({ cursor, limit: 1 } as any, tenantId);
    const hasAfter = qb.andWhere.mock.calls.some(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('l.id > :afterId'),
    );
    expect(hasAfter).toBe(true);
  });

  it('findMany ignores invalid cursor', async () => {
    const qb = createQB({});
    qb.getMany.mockResolvedValue([{ id: 'id1' }] as any);
    (listingRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

    await service.findMany({ cursor: 'not-base64url', limit: 1 } as any, tenantId);
    const hasAfter = qb.andWhere.mock.calls.some(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('l.id > :afterId'),
    );
    expect(hasAfter).toBe(false);
  });

  it('findMany applies property filters (sector/type/address) and geo radius with distance ordering', async () => {
    const qb = createQB({});
    qb.getMany.mockResolvedValue([{ id: 'id1' }] as any);
    (listingRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

    await service.findMany(
      {
        sector: 'Centro',
        type: 'apartment',
        address: 'Alameda',
        latitude: -23.56,
        longitude: -46.64,
        radiusKm: 5,
        sortBy: 'distance',
        order: 'desc',
        limit: 10,
      } as any,
      tenantId,
    );

    const clauses = qb.andWhere.mock.calls.map((c: any[]) => String(c[0]));
    expect(clauses.some((s: string) => s.includes('p.sector = :sector'))).toBe(true);
    expect(clauses.some((s: string) => s.includes('p.type = :ptype'))).toBe(true);
    expect(clauses.some((s: string) => s.includes('p.address ILIKE :addr'))).toBe(true);
    // Geo clause present
    expect(clauses.some((s: string) => s.includes('ST_DWithin'))).toBe(true);
    // KNN ordering first, then secondary createdAt with requested order
    expect(qb.addOrderBy).toHaveBeenNthCalledWith(
      1,
      'p.location <-> ST_SetSRID(ST_MakePoint(:lngOrder, :latOrder), 4326)',
      'ASC',
    );
    expect(qb.addOrderBy).toHaveBeenNthCalledWith(2, 'l.createdAt', 'DESC');
  });
});
