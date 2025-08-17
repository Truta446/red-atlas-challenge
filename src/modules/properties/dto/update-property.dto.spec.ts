import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdatePropertyDto } from './update-property.dto';

describe('UpdatePropertyDto validation', () => {
  it('accepts optional fields with correct types', async () => {
    const dto = plainToInstance(UpdatePropertyDto, {
      address: 'Nova',
      sector: 'Sul',
      type: 'apt',
      price: 123,
      latitude: -1,
      longitude: -2,
    });
    const errs = await validate(dto);
    expect(errs).toHaveLength(0);
  });

  it('rejects wrong types', async () => {
    const dto = plainToInstance(UpdatePropertyDto, {
      address: 1,
      sector: 2,
      type: 3,
      price: 'x',
      latitude: 'y',
      longitude: [],
    } as any);
    const errs = await validate(dto);
    expect(errs.length).toBeGreaterThan(0);
  });
});
