import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateListingDto } from './create-listing.dto';

describe('CreateListingDto validation', () => {
  it('accepts valid payload', async () => {
    const dto = plainToInstance(CreateListingDto, {
      propertyId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'active',
      price: 350000,
    });
    const errs = await validate(dto);
    expect(errs).toHaveLength(0);
  });

  it('rejects invalid enum/uuid/number', async () => {
    const dto = plainToInstance(CreateListingDto, {
      propertyId: 'not-uuid',
      status: 'draft',
      price: 'x',
    } as any);
    const errs = await validate(dto);
    expect(errs.length).toBeGreaterThan(0);
  });
});
