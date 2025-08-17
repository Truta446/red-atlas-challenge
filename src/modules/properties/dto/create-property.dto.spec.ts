import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePropertyDto } from './create-property.dto';

describe('CreatePropertyDto validation', () => {
  it('accepts valid payload', async () => {
    const dto = plainToInstance(CreatePropertyDto, {
      address: 'Rua 1, 123',
      sector: 'Centro',
      type: 'house',
      price: '350000.50',
      latitude: -23.5,
      longitude: -46.6,
    });
    const errs = await validate(dto);
    expect(errs).toHaveLength(0);
  });

  it('rejects invalid types and lengths', async () => {
    const dto = plainToInstance(CreatePropertyDto, {
      address: 123,
      sector: 456,
      type: [],
      price: 10, // must be string per DTO
      latitude: 'x',
      longitude: {},
    } as any);
    const errs = await validate(dto);
    expect(errs.length).toBeGreaterThan(0);
  });
});
