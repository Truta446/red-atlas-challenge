import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Cache } from 'cache-manager';
import { Repository } from 'typeorm';

import { CreatePropertyDto } from '../dto/create-property.dto';
import { QueryPropertiesDto } from '../dto/query-properties.dto';
import { UpdatePropertyDto } from '../dto/update-property.dto';
import { Property } from '../entities/property.entity';

function encodeCursor(id: string): string {
  return Buffer.from(id, 'utf8').toString('base64url');
}
function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
function decodeCursor(cursor: string): string | null {
  try {
    const decoded: string = Buffer.from(cursor, 'base64url').toString('utf8');
    return isUuid(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

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
    const cacheKey = `tenant:${tenantId}:properties:list:v1:${normalize({
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
    const cached = await this.cache.get<{ items: Property[]; nextCursor: string | null }>(cacheKey);
    if (cached) return cached;

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
      typeof query.latitude === 'number' &&
      typeof query.longitude === 'number' &&
      typeof query.radiusKm === 'number';
    if (hasGeoFilter) {
      const radiusKm: number = Number(query.radiusKm);
      qb.andWhere(`ST_DWithin(p.location::geography, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :meters)`, {
        lng: query.longitude,
        lat: query.latitude,
        meters: radiusKm * 1000,
      });
      if (query.sortBy === 'distance') {
        // KNN order by proximity using GiST index
        qb.addOrderBy('p.location <-> ST_SetSRID(ST_MakePoint(:lngOrder, :latOrder), 4326)', 'ASC').setParameters({
          lngOrder: query.longitude,
          latOrder: query.latitude,
        });
      }
    }

    // Sorting whitelist enforcement
    const allowedSort = new Set(['price', 'createdAt', 'distance']);
    const sortByRaw = query.sortBy && allowedSort.has(query.sortBy) ? (query.sortBy as string) : 'createdAt';
    const order: 'ASC' | 'DESC' = (query.order || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    // When geo distance is present we already ordered by distance first; add secondary order for determinism
    if (sortByRaw !== 'distance') {
      qb.addOrderBy(`p.${sortByRaw}` as any, order);
    }

    const limit: number = Math.min(query.limit || 25, 100);
    if (query.cursor) {
      const afterId: string | null = decodeCursor(query.cursor);
      if (afterId) {
        qb.andWhere('p.id > :afterId', { afterId });
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
    const nextCursor: string | null = hasMore ? encodeCursor(items[items.length - 1].id) : null;
    const result = { items, nextCursor };
    // Short TTL cache (helps p95 with sustained identical queries)
    await this.cache.set(cacheKey, result, 30_000);
    return result;
  }
}
