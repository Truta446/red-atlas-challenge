import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { QueryPropertiesDto } from './query-properties.dto';

describe('QueryPropertiesDto validation', () => {
  it('accepts valid values', async () => {
    const dto = plainToInstance(QueryPropertiesDto, {
      sector: 'Moema',
      type: 'apartment',
      address: 'Alameda',
      minPrice: 100000,
      maxPrice: 500000,
      fromDate: '2024-01-01T00:00:00.000Z',
      toDate: '2024-12-31T23:59:59.999Z',
      latitude: -23.56,
      longitude: -46.64,
      radiusKm: 5,
      cursor: 'Y3Vyc29y',
      limit: 50,
      sortBy: 'price',
      order: 'asc',
    });
    const errs = await validate(dto);
    expect(errs).toHaveLength(0);
  });

  it('rejects invalid dates and order/sortBy', async () => {
    const dto = plainToInstance(QueryPropertiesDto, {
      fromDate: 'not-a-date',
      toDate: 'also-bad',
      sortBy: 'unknown',
      order: 'up',
    } as any);
    const errs = await validate(dto);
    expect(errs.length).toBeGreaterThan(0);
  });

  it('rejects wrong types for numeric fields', async () => {
    const dto = plainToInstance(QueryPropertiesDto, {
      minPrice: 'a',
      maxPrice: 'b',
      latitude: 'x',
      longitude: [],
      radiusKm: {},
      limit: 0, // not positive
    } as any);
    const errs = await validate(dto);
    expect(errs.length).toBeGreaterThan(0);
  });
});
