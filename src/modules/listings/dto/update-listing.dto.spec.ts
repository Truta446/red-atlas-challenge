import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateListingDto } from './update-listing.dto';

describe('UpdateListingDto validation', () => {
  it('accepts valid optional fields', async () => {
    const dto = plainToInstance(UpdateListingDto, {
      status: 'paused',
      price: 360000,
    });
    const errs = await validate(dto);
    expect(errs).toHaveLength(0);
  });

  it('rejects invalid enum/number', async () => {
    const dto = plainToInstance(UpdateListingDto, {
      status: 'draft',
      price: 'x',
    } as any);
    const errs = await validate(dto);
    expect(errs.length).toBeGreaterThan(0);
  });
});
