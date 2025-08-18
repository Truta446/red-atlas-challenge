import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { decodeIdCursor, encodeIdCursor } from '../../../common/utils/cursor';
import { Listing } from '../../listings/entities/listing.entity';
import { Property } from '../../properties/entities/property.entity';
import { CreateTransactionDto } from '../dto/create-transaction.dto';
import type { QueryTransactionsDto } from '../dto/query-transactions.dto';
import { UpdateTransactionDto } from '../dto/update-transaction.dto';
import { Transaction } from '../entities/transaction.entity';

@Injectable()
export class TransactionsService {
  @InjectRepository(Transaction) private readonly repo!: Repository<Transaction>;
  @InjectRepository(Property) private readonly propRepo!: Repository<Property>;
  @InjectRepository(Listing) private readonly listRepo!: Repository<Listing>;

  public async create(dto: CreateTransactionDto, tenantId: string): Promise<Transaction> {
    // Ensure property belongs to tenant
    const prop = await this.propRepo.findOne({ where: { id: dto.propertyId, tenantId } });
    if (!prop) throw new Error('Property not found for tenant');

    if (dto.listingId) {
      const listing = await this.listRepo.findOne({ where: { id: dto.listingId, tenantId } });
      if (!listing) throw new Error('Listing not found for tenant');
    }

    const insert = await this.repo
      .createQueryBuilder()
      .insert()
      .into(Transaction)
      .values({
        tenantId,
        property: { id: dto.propertyId } as any,
        listing: dto.listingId ? ({ id: dto.listingId } as any) : undefined,
        price: dto.price as any,
        date: dto.date as any,
      })
      .returning(['id'])
      .execute();
    const id: string | undefined = insert.identifiers?.[0]?.id ?? insert.raw?.[0]?.id;
    if (!id) throw new Error('Failed to create transaction');
    const created = await this.repo.findOne({ where: { id, tenantId }, relations: ['property', 'listing'] });
    if (!created) throw new Error('Transaction not found after creation');
    return created;
  }

  public async findOne(id: string, tenantId: string): Promise<Transaction | null> {
    return this.repo.findOne({ where: { id, tenantId }, relations: ['property', 'listing'] });
  }

  public async update(id: string, dto: UpdateTransactionDto, tenantId: string): Promise<Transaction> {
    const set: Record<string, any> = {};
    if (dto.listingId) set.listing = { id: dto.listingId } as any;
    if (typeof dto.price === 'number') set.price = dto.price as any;
    if (typeof dto.date === 'string') set.date = dto.date as any;
    await this.repo.update({ id, tenantId }, set);
    const updated = await this.findOne(id, tenantId);
    if (!updated) throw new Error('Transaction not found');
    return updated;
  }

  public async softDelete(id: string, tenantId: string): Promise<void> {
    await this.repo.softDelete({ id, tenantId });
  }

  public async restore(id: string, tenantId: string): Promise<Transaction> {
    await this.repo.restore({ id, tenantId });
    const entity = await this.findOne(id, tenantId);
    if (!entity) throw new Error('Transaction not found');
    return entity;
  }

  public async findMany(
    query: QueryTransactionsDto,
    tenantId: string,
  ): Promise<{ items: Transaction[]; nextCursor: string | null }> {
    const qb = this.repo.createQueryBuilder('t');
    qb.where('t.deletedAt IS NULL');
    qb.andWhere('t.tenantId = :tenantId', { tenantId });

    const qbAny: any = qb as any;
    if (typeof qbAny.leftJoinAndSelect === 'function') {
      qbAny.leftJoinAndSelect('t.property', 'p');
      qbAny.leftJoinAndSelect('t.listing', 'l');
    } else {
      if (typeof qbAny.leftJoin === 'function') {
        qbAny.leftJoin('t.property', 'p');
        qbAny.leftJoin('t.listing', 'l');
      }
    }

    qb.select(['t.id', 't.tenantId', 't.createdAt', 't.updatedAt', 't.price', 't.date']);
    if (typeof (qb as any).addSelect === 'function') {
      (qb as any).addSelect(['p.id', 'p.address', 'p.sector', 'p.type']);
      (qb as any).addSelect(['l.id', 'l.status', 'l.price']);
    }

    if (query.propertyId) qb.andWhere('p.id = :pid', { pid: query.propertyId });
    if (query.listingId) qb.andWhere('l.id = :lid', { lid: query.listingId });
    if (typeof query.minPrice === 'number') qb.andWhere('t.price >= :min', { min: query.minPrice });
    if (typeof query.maxPrice === 'number') qb.andWhere('t.price <= :max', { max: query.maxPrice });
    if (query.fromDate) qb.andWhere('t.date >= :from', { from: query.fromDate });
    if (query.toDate) qb.andWhere('t.date <= :to', { to: query.toDate });

    // Property-based filters
    if (query.sector) qb.andWhere('p.sector = :sector', { sector: query.sector });
    if (query.type) qb.andWhere('p.type = :ptype', { ptype: query.type });
    if (query.address) qb.andWhere('p.address ILIKE :addr', { addr: `%${query.address}%` });

    // Geo radius using property's location
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

    // Sorting
    const allowedSort = new Set(['date', 'price', 'createdAt', 'distance']);
    const sortByRaw =
      (query as any).sortBy && allowedSort.has((query as any).sortBy) ? ((query as any).sortBy as string) : 'date';
    const order: 'ASC' | 'DESC' = ((query as any).order || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    if (sortByRaw === 'distance' && hasGeo) {
      qb.addOrderBy('p.location <-> ST_SetSRID(ST_MakePoint(:lngOrder, :latOrder), 4326)', 'ASC').setParameters({
        lngOrder: (query as any).longitude,
        latOrder: (query as any).latitude,
      });
      // Secondary order for determinism
      qb.addOrderBy('t.date', order);
    } else {
      qb.addOrderBy(`t.${sortByRaw}` as any, order);
    }

    const limit: number = Math.min(query.limit || 25, 100);
    if (query.cursor) {
      const afterId = decodeIdCursor(query.cursor);
      if (afterId) qb.andWhere('t.id > :afterId', { afterId });
    }
    qb.take(limit + 1);

    const rows = await qb.getMany();
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? encodeIdCursor(items[items.length - 1].id) : null;
    return { items, nextCursor };
  }
}
