import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateTransactionDto } from './update-transaction.dto';

describe('UpdateTransactionDto validation', () => {
  it('accepts valid optional fields', async () => {
    const dto = plainToInstance(UpdateTransactionDto, {
      listingId: '550e8400-e29b-41d4-a716-446655440001',
      price: 430000,
      date: '2025-08-02',
    });
    const errs = await validate(dto);
    expect(errs).toHaveLength(0);
  });

  it('rejects invalid uuid/number/date', async () => {
    const dto = plainToInstance(UpdateTransactionDto, {
      listingId: 'not-uuid',
      price: 'x',
      date: 'invalid',
    } as any);
    const errs = await validate(dto);
    expect(errs.length).toBeGreaterThan(0);
  });
});
