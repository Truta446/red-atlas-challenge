import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Listing } from '../../listings/entities/listing.entity';
import { Property } from '../../properties/entities/property.entity';
import { CreateTransactionDto } from '../dto/create-transaction.dto';
import type { QueryTransactionsDto } from '../dto/query-transactions.dto';
import { UpdateTransactionDto } from '../dto/update-transaction.dto';
import { Transaction } from '../entities/transaction.entity';

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
    return this.repo.findOne({ where: { id, tenantId } });
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

    qb.leftJoin('t.property', 'p');
    qb.leftJoin('t.listing', 'l');

    qb.select(['t.id', 't.tenantId', 't.createdAt', 't.updatedAt', 't.price', 't.date']);

    if (query.propertyId) qb.andWhere('p.id = :pid', { pid: query.propertyId });
    if (query.listingId) qb.andWhere('l.id = :lid', { lid: query.listingId });
    if (typeof query.minPrice === 'number') qb.andWhere('t.price >= :min', { min: query.minPrice });
    if (typeof query.maxPrice === 'number') qb.andWhere('t.price <= :max', { max: query.maxPrice });
    if (query.fromDate) qb.andWhere('t.date >= :from', { from: query.fromDate });
    if (query.toDate) qb.andWhere('t.date <= :to', { to: query.toDate });

    const order: 'ASC' | 'DESC' = (query.order || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    qb.addOrderBy('t.date', order);

    const limit: number = Math.min(query.limit || 25, 100);
    if (query.cursor) {
      const afterId = decodeCursor(query.cursor);
      if (afterId) qb.andWhere('t.id > :afterId', { afterId });
    }
    qb.take(limit + 1);

    const rows = await qb.getMany();
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? encodeCursor(items[items.length - 1].id) : null;
    return { items, nextCursor };
  }
}
