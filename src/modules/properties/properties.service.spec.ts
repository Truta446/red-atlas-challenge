import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Repository } from 'typeorm';
import { PropertiesService } from './properties.service';
import { Property } from './property.entity';

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
        { provide: getRepositoryToken(Property), useValue: {
          createQueryBuilder: jest.fn(),
          softDelete: jest.fn(),
          restore: jest.fn(),
          findOne: jest.fn(),
        } },
      ],
    }).compile();

    service = module.get(PropertiesService);
    repo = module.get(getRepositoryToken(Property));
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
});
