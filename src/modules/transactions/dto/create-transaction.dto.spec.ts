import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateTransactionDto } from './create-transaction.dto';

describe('CreateTransactionDto validation', () => {
  it('accepts valid payload', async () => {
    const dto = plainToInstance(CreateTransactionDto, {
      propertyId: '550e8400-e29b-41d4-a716-446655440000',
      listingId: '550e8400-e29b-41d4-a716-446655440001',
      price: 420000,
      date: '2025-08-01',
    });
    const errs = await validate(dto);
    expect(errs).toHaveLength(0);
  });

  it('rejects invalid types/uuid/date', async () => {
    const dto = plainToInstance(CreateTransactionDto, {
      propertyId: 'nope',
      listingId: 123,
      price: 'x',
      date: 'not-a-date',
    } as any);
    const errs = await validate(dto);
    expect(errs.length).toBeGreaterThan(0);
  });
});
