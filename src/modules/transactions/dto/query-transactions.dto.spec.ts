import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { QueryTransactionsDto } from './query-transactions.dto';

describe('QueryTransactionsDto validation', () => {
  it('accepts valid values and transforms numbers', async () => {
    const dto = plainToInstance(QueryTransactionsDto, {
      propertyId: '550e8400-e29b-41d4-a716-446655440000',
      listingId: '550e8400-e29b-41d4-a716-446655440001',
      minPrice: '1000',
      maxPrice: '2000',
      fromDate: '2025-08-01',
      toDate: '2025-08-31',
      limit: '25',
      cursor: 'YWJj',
      order: 'desc',
    });
    const errs = await validate(dto);
    expect(errs).toHaveLength(0);
    expect(dto.minPrice).toBe(1000);
    expect(dto.maxPrice).toBe(2000);
    expect(dto.limit).toBe(25);
  });

  it('rejects invalid uuids', async () => {
    const dto = plainToInstance(QueryTransactionsDto, { propertyId: 'x', listingId: 'y' });
    const errs = await validate(dto);
    expect(errs.length).toBeGreaterThan(0);
  });

  it('rejects invalid dates', async () => {
    const dto = plainToInstance(QueryTransactionsDto, { fromDate: 'nope', toDate: 'also-no' });
    const errs = await validate(dto);
    expect(errs.length).toBeGreaterThan(0);
  });

  it('rejects invalid order', async () => {
    const dto = plainToInstance(QueryTransactionsDto, { order: 'up' });
    const errs = await validate(dto);
    expect(errs.length).toBeGreaterThan(0);
  });

  it('enforces limit bounds', async () => {
    const low = plainToInstance(QueryTransactionsDto, { limit: 0 });
    const high = plainToInstance(QueryTransactionsDto, { limit: 101 });
    const [e1, e2] = await Promise.all([validate(low), validate(high)]);
    expect(e1.length).toBeGreaterThan(0);
    expect(e2.length).toBeGreaterThan(0);
  });

  it('transforms latitude/longitude/radiusKm to numbers', async () => {
    const dto = plainToInstance(QueryTransactionsDto, {
      latitude: '-23.56',
      longitude: '-46.64',
      radiusKm: '7',
    } as any);
    const errs = await validate(dto);
    expect(errs).toHaveLength(0);
    expect(dto.latitude).toBeCloseTo(-23.56);
    expect(dto.longitude).toBeCloseTo(-46.64);
    expect(dto.radiusKm).toBe(7);
  });

  it('rejects non-numeric lat/lng/radiusKm', async () => {
    const dto = plainToInstance(QueryTransactionsDto, {
      latitude: 'a',
      longitude: 'b',
      radiusKm: 'c',
    } as any);
    const errs = await validate(dto);
    expect(errs.length).toBeGreaterThan(0);
  });

  it('accepts only whitelisted sortBy and rejects invalid', async () => {
    const ok = plainToInstance(QueryTransactionsDto, { sortBy: 'price' } as any);
    const bad = plainToInstance(QueryTransactionsDto, { sortBy: 'foo' } as any);
    const [eOk, eBad] = await Promise.all([validate(ok), validate(bad)]);
    expect(eOk).toHaveLength(0);
    expect(eBad.length).toBeGreaterThan(0);
  });
});
