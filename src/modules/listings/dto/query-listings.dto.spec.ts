import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { QueryListingsDto } from './query-listings.dto';

describe('QueryListingsDto validation', () => {
  it('accepts valid values and transforms numbers', async () => {
    const dto = plainToInstance(QueryListingsDto, {
      status: 'active',
      propertyId: '550e8400-e29b-41d4-a716-446655440000',
      minPrice: '1000',
      maxPrice: '2000',
      limit: '50',
      cursor: 'YWJj',
      order: 'asc',
    });
    const errs = await validate(dto);
    expect(errs).toHaveLength(0);
    // transformed
    expect(dto.minPrice).toBe(1000);
    expect(dto.maxPrice).toBe(2000);
    expect(dto.limit).toBe(50);
  });

  it('rejects invalid enum status', async () => {
    const dto = plainToInstance(QueryListingsDto, { status: 'wrong' });
    const errs = await validate(dto);
    expect(errs.length).toBeGreaterThan(0);
  });

  it('rejects invalid UUID', async () => {
    const dto = plainToInstance(QueryListingsDto, { propertyId: 'not-a-uuid' });
    const errs = await validate(dto);
    expect(errs.length).toBeGreaterThan(0);
  });

  it('rejects invalid order', async () => {
    const dto = plainToInstance(QueryListingsDto, { order: 'up' });
    const errs = await validate(dto);
    expect(errs.length).toBeGreaterThan(0);
  });

  it('enforces limit bounds', async () => {
    const low = plainToInstance(QueryListingsDto, { limit: 0 });
    const high = plainToInstance(QueryListingsDto, { limit: 101 });
    const [e1, e2] = await Promise.all([validate(low), validate(high)]);
    expect(e1.length).toBeGreaterThan(0);
    expect(e2.length).toBeGreaterThan(0);
  });

  it('transforms latitude/longitude/radiusKm to numbers', async () => {
    const dto = plainToInstance(QueryListingsDto, {
      latitude: '-23.56',
      longitude: '-46.64',
      radiusKm: '5',
    } as any);
    const errs = await validate(dto);
    expect(errs).toHaveLength(0);
    expect(dto.latitude).toBeCloseTo(-23.56);
    expect(dto.longitude).toBeCloseTo(-46.64);
    expect(dto.radiusKm).toBe(5);
  });

  it('rejects non-numeric lat/lng/radiusKm', async () => {
    const dto = plainToInstance(QueryListingsDto, {
      latitude: 'x',
      longitude: 'y',
      radiusKm: 'z',
    } as any);
    const errs = await validate(dto);
    expect(errs.length).toBeGreaterThan(0);
  });
});
