import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Property } from '../entities/property.entity';
import { PropertiesService } from '../services/properties.service';

function createQB<T>(overrides: Partial<Record<string, any>> = {}) {
  const state: any = {
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    execute: jest.fn(),

    createQueryBuilder: undefined,

    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    getOne: jest.fn(),

    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };
  return { ...state, ...overrides } as any;
}

describe('PropertiesService', () => {
  let service: PropertiesService;
  let repo: jest.Mocked<Repository<Property>>;
  const cache = { store: { reset: jest.fn() }, reset: jest.fn() } as any;
  const tenantId = 'tenant-a';

  beforeEach(async () => {
    jest.resetAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PropertiesService,
        { provide: CACHE_MANAGER, useValue: cache },
        {
          provide: getRepositoryToken(Property),
          useValue: {
            createQueryBuilder: jest.fn(),
            softDelete: jest.fn(),
            restore: jest.fn(),
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(PropertiesService);
    repo = module.get(getRepositoryToken(Property));
  });

  it('findMany applies all simple filters and sorts by createdAt ASC when requested', async () => {
    const qb = createQB();
    qb.getMany.mockResolvedValue([{ id: 'x1' }] as any);
    (repo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

    const query: any = {
      sector: 'Centro',
      type: 'house',
      address: 'Rua',
      minPrice: 100,
      maxPrice: 200,
      fromDate: '2024-01-01T00:00:00.000Z',
      toDate: '2024-12-31T23:59:59.999Z',
      sortBy: 'createdAt',
      order: 'asc',
      limit: 10,
    };
    await service.findMany(query, tenantId);
    // each filter should have been applied
    expect(qb.andWhere).toHaveBeenCalledWith('p.sector = :sector', { sector: 'Centro' });
    expect(qb.andWhere).toHaveBeenCalledWith('p.type = :type', { type: 'house' });
    expect(qb.andWhere).toHaveBeenCalledWith('p.address ILIKE :addr', { addr: '%Rua%' });
    expect(qb.andWhere).toHaveBeenCalledWith('p.price >= :minPrice', { minPrice: 100 });
    expect(qb.andWhere).toHaveBeenCalledWith('p.price <= :maxPrice', { maxPrice: 200 });
    expect(qb.andWhere).toHaveBeenCalledWith('p.createdAt >= :fromDate', { fromDate: query.fromDate });
    expect(qb.andWhere).toHaveBeenCalledWith('p.createdAt <= :toDate', { toDate: query.toDate });
    // standard order call
    const createdAsc = qb.addOrderBy.mock.calls.some(
      (c: any[]) => String(c[0]).includes('p.createdAt') && c[1] === 'ASC',
    );
    expect(createdAsc).toBe(true);
  });

  it('findMany sorts by allowed field price DESC (no geo)', async () => {
    const qb = createQB();
    qb.getMany.mockResolvedValue([{ id: 'y1' }] as any);
    (repo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

    await service.findMany({ sortBy: 'price', order: 'desc', limit: 1 } as any, tenantId);
    const priceDesc = qb.addOrderBy.mock.calls.some((c: any[]) => String(c[0]).includes('p.price') && c[1] === 'DESC');
    expect(priceDesc).toBe(true);
  });

  it('findMany caps limit to 100 when larger value provided', async () => {
    const qb = createQB();
    qb.getMany.mockResolvedValue(new Array(101).fill(0).map((_, i) => ({ id: String(i).padStart(2, '0') })) as any);
    (repo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

    await service.findMany({ limit: 999 } as any, tenantId);
    // take called with limit+1 where limit is capped to 100 -> 101
    expect(qb.take).toHaveBeenCalledWith(101);
  });

  it('findMany defaults sort to createdAt DESC when sortBy is invalid and order=desc', async () => {
    const qb = createQB();
    qb.getMany.mockResolvedValue([{ id: 'p1' }] as any);
    (repo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

    await service.findMany({ limit: 1, sortBy: 'unknown' as any, order: 'desc' } as any, tenantId);
    // Should add SQL order by p.createdAt DESC (since whitelist fallback applies)
    const called = qb.addOrderBy.mock.calls.some((c: any[]) => String(c[0]).includes('p.createdAt') && c[1] === 'DESC');
    expect(called).toBe(true);
  });

  it('findMany with geo filter but sortBy != distance should NOT add KNN order; should add standard order', async () => {
    const qb = createQB();
    qb.getMany.mockResolvedValue([{ id: 'p1' }] as any);
    (repo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

    await service.findMany(
      { latitude: 1, longitude: 2, radiusKm: 3, sortBy: 'price', order: 'asc', limit: 1 } as any,
      tenantId,
    );
    const knnCalled = qb.addOrderBy.mock.calls.some((c: any[]) => String(c[0]).includes('p.location <->'));
    expect(knnCalled).toBe(false);
    const stdOrderCalled = qb.addOrderBy.mock.calls.some(
      (c: any[]) => String(c[0]).includes('p.price') && c[1] === 'ASC',
    );
    expect(stdOrderCalled).toBe(true);
  });

  it('update does not set location when only one coord provided', async () => {
    const updateQB = createQB();
    updateQB.execute.mockResolvedValue({});
    (repo.createQueryBuilder as jest.Mock).mockReturnValueOnce(updateQB);

    const reloadQB = createQB();
    reloadQB.getOne.mockResolvedValue({ id: 'p1' } as any);
    (repo.createQueryBuilder as jest.Mock).mockReturnValueOnce(reloadQB);

    await service.update('p1', { latitude: 10 } as any, tenantId);
    expect(updateQB.set).toHaveBeenCalledTimes(1);
    const arg = updateQB.set.mock.calls[0][0];
    expect(arg.location).toBeUndefined();
  });

  it('create inserts, reloads with GeoJSON and resets cache', async () => {
    const insertQB = createQB();
    insertQB.execute.mockResolvedValue({ identifiers: [{ id: 'p1' }], raw: [{ id: 'p1' }] });
    (repo.createQueryBuilder as jest.Mock).mockReturnValueOnce(insertQB);

    const reloadQB = createQB();
    reloadQB.getOne.mockResolvedValue({ id: 'p1', tenantId } as any);
    // Subsequent call via repo.createQueryBuilder('p') in findOne path inside create
    (repo.createQueryBuilder as jest.Mock).mockReturnValueOnce(reloadQB);

    const dto = { address: 'A', sector: 'S', type: 'apartment', price: 100, latitude: 1, longitude: 2 } as any;
    const created = await service.create(dto, tenantId);

    expect(insertQB.insert).toHaveBeenCalled();
    expect(reloadQB.getOne).toHaveBeenCalled();
    expect(created).toEqual(expect.objectContaining({ id: 'p1' }));
    expect(cache.store.reset).toHaveBeenCalled();
  });

  it('findOne queries with selects and returns property', async () => {
    const qb = createQB();
    qb.getOne.mockResolvedValue({ id: 'p1' } as any);
    (repo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

    const res = await service.findOne('p1', tenantId);
    expect(qb.where).toHaveBeenCalled();
    expect(res?.id).toBe('p1');
  });

  it('update executes update and returns reloaded entity; resets cache', async () => {
    const updateQB = createQB();
    updateQB.execute.mockResolvedValue({});
    (repo.createQueryBuilder as jest.Mock).mockReturnValueOnce(updateQB);

    // reload via findOne
    const reloadQB = createQB();
    reloadQB.getOne.mockResolvedValue({ id: 'p1' } as any);
    (repo.createQueryBuilder as jest.Mock).mockReturnValueOnce(reloadQB);

    const res = await service.update('p1', { address: 'B', latitude: 3, longitude: 4 } as any, tenantId);
    expect(updateQB.update).toHaveBeenCalled();
    expect(res?.id).toBe('p1');
    expect(cache.store.reset).toHaveBeenCalled();
  });

  it('softDelete resets cache', async () => {
    (repo.softDelete as any) = jest.fn().mockResolvedValue({});
    await service.softDelete('p1', tenantId);
    expect(repo.softDelete).toHaveBeenCalledWith({ id: 'p1', tenantId });
    expect(cache.store.reset).toHaveBeenCalled();
  });

  it('restore resets cache and returns entity', async () => {
    (repo.restore as any) = jest.fn().mockResolvedValue({});
    (repo.findOne as any) = jest.fn().mockResolvedValue({ id: 'p1' });
    const res = await service.restore('p1', tenantId);
    expect(repo.restore).toHaveBeenCalledWith({ id: 'p1', tenantId });
    expect(res?.id).toBe('p1');
    expect(cache.store.reset).toHaveBeenCalled();
  });

  it('findMany returns items and cursor', async () => {
    const qb = createQB();
    const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }] as any;
    qb.getMany.mockResolvedValue(rows);
    (repo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

    const res = await service.findMany({ limit: 2, order: 'asc' } as any, tenantId);
    expect(res.items.length).toBe(2);
    expect(res.nextCursor).toBeTruthy();
  });

  it('findMany applies geo filter and distance ordering when lat/lng/radius and sortBy=distance', async () => {
    const qb = createQB({ setParameters: jest.fn().mockReturnThis() });
    qb.getMany.mockResolvedValue([{ id: 'p1' }] as any);
    (repo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

    const res = await service.findMany(
      { latitude: 1, longitude: 2, radiusKm: 3, sortBy: 'distance', limit: 1 } as any,
      tenantId,
    );
    expect(res.items.length).toBe(1);
    // ST_DWithin where added
    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('ST_DWithin'),
      expect.objectContaining({ lng: 2, lat: 1, meters: 3000 }),
    );
    // KNN addOrderBy applied
    expect(qb.addOrderBy).toHaveBeenCalledWith(expect.stringContaining('p.location <-> ST_SetSRID'), 'ASC');
    // Secondary parameters for ordering present
    expect(qb.setParameters).toHaveBeenCalledWith(expect.objectContaining({ lngOrder: 2, latOrder: 1 }));
  });

  it('findMany applies cursor pagination filter when cursor provided', async () => {
    const qb = createQB();
    qb.getMany.mockResolvedValue([{ id: 'p2' }] as any);
    (repo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

    const uuid = '123e4567-e89b-12d3-a456-426614174000';
    const cursor = Buffer.from(uuid, 'utf8').toString('base64url');
    await service.findMany({ cursor, limit: 1 } as any, tenantId);
    // Ensure id filter is applied
    const calledWithIdFilter = qb.andWhere.mock.calls.some(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('p.id > :afterId'),
    );
    expect(calledWithIdFilter).toBe(true);
  });

  it('findMany ignores invalid cursor', async () => {
    const qb = createQB();
    qb.getMany.mockResolvedValue([{ id: 'p1' }] as any);
    (repo.createQueryBuilder as jest.Mock).mockReturnValue(qb);

    await service.findMany({ cursor: 'not-base64url', limit: 1 } as any, tenantId);
    const calledWithIdFilter = qb.andWhere.mock.calls.some(
      (c: any[]) => typeof c[0] === 'string' && c[0].includes('p.id > :afterId'),
    );
    expect(calledWithIdFilter).toBe(false);
  });
});
