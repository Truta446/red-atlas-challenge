import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Cache } from 'cache-manager';
import { Repository } from 'typeorm';

import { decodeIdCursor, encodeCursorPayload, tryDecodeCursorPayload } from '../../../common/utils/cursor';
import { CreatePropertyDto } from '../dto/create-property.dto';
import { QueryPropertiesDto } from '../dto/query-properties.dto';
import { UpdatePropertyDto } from '../dto/update-property.dto';
import { Property } from '../entities/property.entity';

@Injectable()
export class PropertiesService {
  @Inject(CACHE_MANAGER) private readonly cache!: Cache;
  @InjectRepository(Property) private readonly repo: Repository<Property>;

  public async create(dto: CreatePropertyDto, tenantId: string): Promise<Property> {
    const insertResult = await this.repo
      .createQueryBuilder()
      .insert()
      .into(Property)
      .values({
        address: dto.address,
        sector: dto.sector,
        type: dto.type,
        price: dto.price,
        tenantId,
        // use raw SQL expression so NOT NULL is satisfied
        location: () => 'ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)',
      })
      .setParameters({ lng: dto.longitude, lat: dto.latitude })
      .returning(['id'])
      .execute();

    const newId: string | undefined = insertResult.identifiers?.[0]?.id ?? insertResult.raw?.[0]?.id;
    if (!newId) throw new Error('Failed to create property (no id returned)');
    const reloaded: Property | null = await this.repo
      .createQueryBuilder('p')
      .where('p.id = :id', { id: newId })
      .addSelect('p.location')
      .addSelect('ST_AsGeoJSON(p.location)', 'locationGeoJSON')
      .getOne();
    if (!reloaded) throw new Error('Property not found after creation');
    // Invalidate list caches (simple strategy for challenge): reset all
    const reset = (this.cache as any).store?.reset ?? (this.cache as any).reset;
    if (typeof reset === 'function') {
      await reset.call((this.cache as any).store || this.cache);
    }
    return reloaded;
  }

  public async softDelete(id: string, tenantId: string): Promise<void> {
    await this.repo.softDelete({ id, tenantId });
    {
      const reset = (this.cache as any).store?.reset ?? (this.cache as any).reset;
      if (typeof reset === 'function') {
        await reset.call((this.cache as any).store || this.cache);
      }
    }
  }

  public async restore(id: string, tenantId: string): Promise<Property> {
    await this.repo.restore({ id, tenantId });
    const entity: Property | null = await this.repo.findOne({ where: { id, tenantId } });
    if (!entity) throw new Error('Property not found');
    {
      const reset = (this.cache as any).store?.reset ?? (this.cache as any).reset;
      if (typeof reset === 'function') {
        await reset.call((this.cache as any).store || this.cache);
      }
    }
    return entity;
  }

  public async findOne(id: string, tenantId: string): Promise<Property | null> {
    const qb = this.repo.createQueryBuilder('p');
    qb.where('p.id = :id', { id }).andWhere('p.tenantId = :tenantId', { tenantId }).andWhere('p.deletedAt IS NULL');
    qb.addSelect('p.location');
    qb.addSelect('ST_AsGeoJSON(p.location)', 'locationGeoJSON');
    return qb.getOne();
  }

  public async update(id: string, dto: UpdatePropertyDto, tenantId: string): Promise<Property> {
    // Build partial set for simple columns
    const set: Record<string, any> = {};
    if (typeof dto.address === 'string') set.address = dto.address;
    if (typeof dto.sector === 'string') set.sector = dto.sector;
    if (typeof dto.type === 'string') set.type = dto.type;
    if (typeof dto.price === 'number') set.price = dto.price;

    const qb = this.repo
      .createQueryBuilder()
      .update(Property)
      .set(set)
      .where('id = :id AND tenant_id = :tenantId', { id, tenantId });

    // If both coordinates provided, update location atomically
    if (typeof dto.latitude === 'number' && typeof dto.longitude === 'number') {
      qb.set({ ...set, location: () => 'ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)' }).setParameters({
        lng: dto.longitude,
        lat: dto.latitude,
      });
    }

    await qb.execute();

    const updated: Property | null = await this.findOne(id, tenantId);
    if (!updated) throw new Error('Property not found');
    {
      const reset = (this.cache as any).store?.reset ?? (this.cache as any).reset;
      if (typeof reset === 'function') {
        await reset.call((this.cache as any).store || this.cache);
      }
    }
    return updated;
  }

  public async findMany(
    query: QueryPropertiesDto,
    tenantId: string,
  ): Promise<{ items: Property[]; nextCursor: string | null }> {
    // Read-through cache (avoid DB under repeated identical queries)
    const normalize = (q: Record<string, unknown>): string => {
      const entries = Object.entries(q)
        .filter(([_, v]) => v !== undefined && v !== null && v !== '')
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
      return JSON.stringify(entries);
    };
    // bump version to v2 due to new cursor format
    const cacheKey = `tenant:${tenantId}:properties:list:v2:${normalize({
      sector: query.sector,
      type: query.type,
      address: query.address,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      fromDate: query.fromDate,
      toDate: query.toDate,
      latitude: query.latitude,
      longitude: query.longitude,
      radiusKm: query.radiusKm,
      sortBy: query.sortBy,
      order: query.order,
      limit: query.limit,
      cursor: query.cursor,
    })}`;
    const cacheAny: any = this.cache as any;
    if (typeof cacheAny?.get === 'function') {
      const cached = (await cacheAny.get(cacheKey)) as { items: Property[]; nextCursor: string | null } | undefined;
      if (cached) return cached;
    }

    const qb = this.repo.createQueryBuilder('p');
    qb.where('p.deletedAt IS NULL');

    // Scope by tenant (from auth)
    qb.andWhere('p.tenantId = :tenantId', { tenantId });

    // Select minimal columns by default (omit geometry to save CPU/payload)
    qb.select(['p.id', 'p.tenantId', 'p.createdAt', 'p.updatedAt', 'p.address', 'p.sector', 'p.type', 'p.price']);

    if (query.sector) qb.andWhere('p.sector = :sector', { sector: query.sector });
    if (query.type) qb.andWhere('p.type = :type', { type: query.type });
    if (query.address) qb.andWhere('p.address ILIKE :addr', { addr: `%${query.address}%` });

    if (query.minPrice) qb.andWhere('p.price >= :minPrice', { minPrice: query.minPrice });
    if (query.maxPrice) qb.andWhere('p.price <= :maxPrice', { maxPrice: query.maxPrice });

    if (query.fromDate) qb.andWhere('p.createdAt >= :fromDate', { fromDate: query.fromDate });
    if (query.toDate) qb.andWhere('p.createdAt <= :toDate', { toDate: query.toDate });

    const hasGeoFilter =
      typeof query.latitude === 'number' && typeof query.longitude === 'number' && typeof query.radiusKm === 'number';
    if (hasGeoFilter) {
      const radiusKm: number = Number(query.radiusKm);
      qb.andWhere(`ST_DWithin(p.location::geography, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :meters)`, {
        lng: query.longitude,
        lat: query.latitude,
        meters: radiusKm * 1000,
      });
      if (query.sortBy === 'distance') {
        // KNN order by proximity using GiST index on geography (matches idx_prop_location_geog)
        qb.addOrderBy(
          'p.location <-> ST_SetSRID(ST_MakePoint(:lngOrder, :latOrder), 4326)',
          'ASC',
        ).setParameters({
          lngOrder: query.longitude,
          latOrder: query.latitude,
        });
        // Also project exact distance for cursor filtering
        qb.addSelect(
          'ST_Distance(p.location::geography, ST_SetSRID(ST_MakePoint(:lngOrder, :latOrder), 4326)::geography)',
          'distanceOrder',
        );
      }
    }

    // Sorting whitelist enforcement
    const allowedSort = new Set(['price', 'createdAt', 'distance']);
    const sortByRaw = query.sortBy && allowedSort.has(query.sortBy) ? (query.sortBy as string) : 'createdAt';
    const order: 'ASC' | 'DESC' = (query.order || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    // When not distance, order by field + id for determinism and index usage
    if (sortByRaw !== 'distance') {
      qb.addOrderBy(`p.${sortByRaw}` as any, order);
      qb.addOrderBy('p.id', order);
    } else {
      // distance ordering already added above; ensure secondary by id
      qb.addOrderBy('p.id', 'ASC');
    }

    const limit: number = Math.min(query.limit || 25, 100);
    if (query.cursor) {
      const payload = tryDecodeCursorPayload(query.cursor);
      if (payload) {
        // Ensure cursor matches current sort; otherwise ignore to avoid mismatched paging
        if (payload.sortBy === sortByRaw && payload.order === order) {
          if (sortByRaw === 'createdAt') {
            const cmp = order === 'ASC' ? '>' : '<';
            qb.andWhere(`(p.created_at, p.id) ${cmp} (:cVal, :cId)`, {
              cVal: payload.lastValue,
              cId: payload.lastId,
            });
          } else if (sortByRaw === 'price') {
            const cmp = order === 'ASC' ? '>' : '<';
            qb.andWhere(`(p.price, p.id) ${cmp} (:cVal, :cId)`, {
              cVal: payload.lastValue,
              cId: payload.lastId,
            });
          } else if (sortByRaw === 'distance' && hasGeoFilter) {
            // Use computed distance expression for comparison
            const cmp = '>';
            qb.andWhere(
              `(
                ST_Distance(p.location::geography, ST_SetSRID(ST_MakePoint(:lngOrder, :latOrder), 4326)::geography),
                p.id
              ) ${cmp} (:cVal, :cId)`,
              {
                cVal: payload.lastValue,
                cId: payload.lastId,
              },
            );
          }
        }
      } else {
        // Legacy cursor: only id. Keep backward compatibility
        const afterId: string | null = decodeIdCursor(query.cursor);
        if (afterId) {
          const cmp = order === 'ASC' ? '>' : '<';
          qb.andWhere(`p.id ${cmp} :afterId`, { afterId });
        }
      }
    }
    qb.take(limit + 1);

    // Only project geometry/GeoJSON when explicitly needed (geo filter or distance sort)
    if (hasGeoFilter || sortByRaw === 'distance') {
      // Add location fields late to keep planner unaffected when not needed
      qb.addSelect('p.location');
      qb.addSelect('ST_AsGeoJSON(p.location)', 'locationGeoJSON');
    }

    const rows: Property[] = await qb.getMany();
    const hasMore: boolean = rows.length > limit;
    const items: Property[] = hasMore ? rows.slice(0, limit) : rows;
    let nextCursor: string | null = null;
    if (hasMore) {
      const last = items[items.length - 1] as any;
      if (sortByRaw === 'createdAt') {
        nextCursor = encodeCursorPayload({ sortBy: 'createdAt', order, lastValue: last.createdAt, lastId: last.id });
      } else if (sortByRaw === 'price') {
        nextCursor = encodeCursorPayload({ sortBy: 'price', order, lastValue: last.price, lastId: last.id });
      } else if (sortByRaw === 'distance') {
        // distanceOrder is selected only when needed; default to null if absent
        const lastDist = last?.distanceOrder ?? null;
        nextCursor = encodeCursorPayload({ sortBy: 'distance', order: 'ASC', lastValue: lastDist, lastId: last.id });
      }
    }
    const result = { items, nextCursor };

    if (typeof cacheAny?.set === 'function') {
      await cacheAny.set(cacheKey, result, 30_000);
    }

    return result;
  }
}
