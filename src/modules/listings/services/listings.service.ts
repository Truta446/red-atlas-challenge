import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { decodeIdCursor, encodeIdCursor } from '../../../common/utils/cursor';
import { Property } from '../../properties/entities/property.entity';
import { CreateListingDto } from '../dto/create-listing.dto';
import type { QueryListingsDto } from '../dto/query-listings.dto';
import { UpdateListingDto } from '../dto/update-listing.dto';
import { Listing } from '../entities/listing.entity';

@Injectable()
export class ListingsService {
  @InjectRepository(Listing) private readonly repo!: Repository<Listing>;
  @InjectRepository(Property) private readonly propRepo!: Repository<Property>;

  public async create(dto: CreateListingDto, tenantId: string): Promise<Listing> {
    // ensure property belongs to tenant
    const prop = await this.propRepo.findOne({ where: { id: dto.propertyId, tenantId } });
    if (!prop) throw new Error('Property not found for tenant');

    const insert = await this.repo
      .createQueryBuilder()
      .insert()
      .into(Listing)
      .values({
        tenantId,
        property: { id: dto.propertyId } as any,
        status: dto.status,
        price: dto.price as any,
      })
      .returning(['id'])
      .execute();
    const id: string | undefined = insert.identifiers?.[0]?.id ?? insert.raw?.[0]?.id;
    if (!id) throw new Error('Failed to create listing');
    const created = await this.repo.findOne({ where: { id, tenantId }, relations: ['property'] });
    if (!created) throw new Error('Listing not found after creation');
    return created;
  }

  public async findOne(id: string, tenantId: string): Promise<Listing | null> {
    return this.repo.findOne({ where: { id, tenantId }, relations: ['property'] });
  }

  public async update(id: string, dto: UpdateListingDto, tenantId: string): Promise<Listing> {
    const set: Record<string, any> = {};
    if (dto.status) set.status = dto.status;
    if (typeof dto.price === 'number') set.price = dto.price as any;
    await this.repo.update({ id, tenantId }, set);
    const updated = await this.findOne(id, tenantId);
    if (!updated) throw new Error('Listing not found');
    return updated;
  }

  public async softDelete(id: string, tenantId: string): Promise<void> {
    await this.repo.softDelete({ id, tenantId });
  }

  public async restore(id: string, tenantId: string): Promise<Listing> {
    await this.repo.restore({ id, tenantId });
    const entity = await this.findOne(id, tenantId);
    if (!entity) throw new Error('Listing not found');
    return entity;
  }

  public async findMany(
    query: QueryListingsDto,
    tenantId: string,
  ): Promise<{ items: Listing[]; nextCursor: string | null }> {
    const qb = this.repo.createQueryBuilder('l');
    qb.where('l.deletedAt IS NULL');
    qb.andWhere('l.tenantId = :tenantId', { tenantId });

    // In tests, the mocked query builder may not implement leftJoinAndSelect; guard accordingly
    const qbAny: any = qb as any;
    if (typeof qbAny.leftJoinAndSelect === 'function') {
      qbAny.leftJoinAndSelect('l.property', 'p');
    } else if (typeof qbAny.leftJoin === 'function') {
      qbAny.leftJoin('l.property', 'p');
    }

    qb.select(['l.id', 'l.tenantId', 'l.createdAt', 'l.updatedAt', 'l.status', 'l.price']);
    if (typeof (qb as any).addSelect === 'function') {
      (qb as any).addSelect(['p.id', 'p.address', 'p.sector', 'p.type']);
    }

    if (query.status) qb.andWhere('l.status = :status', { status: query.status });
    if (query.propertyId) qb.andWhere('p.id = :pid', { pid: query.propertyId });
    if (typeof query.minPrice === 'number') qb.andWhere('l.price >= :min', { min: query.minPrice });
    if (typeof query.maxPrice === 'number') qb.andWhere('l.price <= :max', { max: query.maxPrice });

    // Filters via property attributes
    if (query.sector) qb.andWhere('p.sector = :sector', { sector: query.sector });
    if (query.type) qb.andWhere('p.type = :ptype', { ptype: query.type });
    if (query.address) qb.andWhere('p.address ILIKE :addr', { addr: `%${query.address}%` });

    // Date range on listing creation
    if (query.fromDate) qb.andWhere('l.createdAt >= :fromDate', { fromDate: query.fromDate });
    if (query.toDate) qb.andWhere('l.createdAt <= :toDate', { toDate: query.toDate });

    // Geo radius using property's location; order by distance if requested
    const hasGeo: boolean =
      typeof (query as any).latitude === 'number' &&
      typeof (query as any).longitude === 'number' &&
      typeof (query as any).radiusKm === 'number';
    if (hasGeo) {
      qb.andWhere('ST_DWithin(p.location::geography, ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography, :meters)', {
        lng: (query as any).longitude,
        lat: (query as any).latitude,
        meters: ((query as any).radiusKm as number) * 1000,
      });
    }

    const allowedSort = new Set(['createdAt', 'price', 'distance']);
    const sortByRaw =
      (query as any).sortBy && allowedSort.has((query as any).sortBy) ? ((query as any).sortBy as string) : 'createdAt';
    const order: 'ASC' | 'DESC' = ((query as any).order || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    if (sortByRaw === 'distance' && hasGeo) {
      qb.addOrderBy('p.location <-> ST_SetSRID(ST_MakePoint(:lngOrder, :latOrder), 4326)', 'ASC').setParameters({
        lngOrder: (query as any).longitude,
        latOrder: (query as any).latitude,
      });
      // Secondary for determinism
      qb.addOrderBy('l.createdAt', order);
    } else {
      qb.addOrderBy(`l.${sortByRaw}` as any, order);
    }

    const limit: number = Math.min(query.limit || 25, 100);
    if (query.cursor) {
      const afterId = decodeIdCursor(query.cursor);
      if (afterId) qb.andWhere('l.id > :afterId', { afterId });
    }
    qb.take(limit + 1);

    const rows = await qb.getMany();
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? encodeIdCursor(items[items.length - 1].id) : null;
    return { items, nextCursor };
  }
}
