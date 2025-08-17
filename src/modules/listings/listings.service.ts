import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Listing } from './listing.entity';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { Property } from '../properties/property.entity';
import type { QueryListingsDto } from './dto/query-listings.dto';

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
    return this.repo.findOne({ where: { id, tenantId } });
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

  public async findMany(query: QueryListingsDto, tenantId: string): Promise<{ items: Listing[]; nextCursor: string | null }> {
    const qb = this.repo.createQueryBuilder('l');
    qb.where('l.deletedAt IS NULL');
    qb.andWhere('l.tenantId = :tenantId', { tenantId });

    qb.leftJoin('l.property', 'p');

    qb.select(['l.id', 'l.tenantId', 'l.createdAt', 'l.updatedAt', 'l.status', 'l.price']);

    if (query.status) qb.andWhere('l.status = :status', { status: query.status });
    if (query.propertyId) qb.andWhere('p.id = :pid', { pid: query.propertyId });
    if (typeof query.minPrice === 'number') qb.andWhere('l.price >= :min', { min: query.minPrice });
    if (typeof query.maxPrice === 'number') qb.andWhere('l.price <= :max', { max: query.maxPrice });

    const order: 'ASC' | 'DESC' = (query.order || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    qb.addOrderBy('l.createdAt', order);

    const limit: number = Math.min(query.limit || 25, 100);
    if (query.cursor) {
      const afterId = decodeCursor(query.cursor);
      if (afterId) qb.andWhere('l.id > :afterId', { afterId });
    }
    qb.take(limit + 1);

    const rows = await qb.getMany();
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? encodeCursor(items[items.length - 1].id) : null;
    return { items, nextCursor };
  }
}
