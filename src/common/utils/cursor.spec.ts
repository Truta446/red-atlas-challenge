import { decodeIdCursor, encodeCursorPayload, encodeIdCursor, tryDecodeCursorPayload } from './cursor';

describe('cursor utils', () => {
  it('encodes/decodes simple id cursor (roundtrip)', () => {
    const id = '123e4567-e89b-12d3-a456-426614174000';
    const cur = encodeIdCursor(id);
    expect(typeof cur).toBe('string');
    const back = decodeIdCursor(cur);
    expect(back).toBe(id);
  });

  it('decodeIdCursor returns null for invalid base64 or non-uuid', () => {
    expect(decodeIdCursor('not-base64url')).toBeNull();
    const cur = Buffer.from('not-a-uuid', 'utf8').toString('base64url');
    expect(decodeIdCursor(cur)).toBeNull();
  });

  it('encodes/decodes cursor payload successfully', () => {
    const payload = {
      sortBy: 'price' as const,
      order: 'ASC' as const,
      lastValue: 123,
      lastId: '123e4567-e89b-12d3-a456-426614174000',
    };
    const cur = encodeCursorPayload(payload);
    const back = tryDecodeCursorPayload(cur);
    expect(back).toEqual(payload);
  });

  it('tryDecodeCursorPayload rejects invalid shapes and uuids', () => {
    // not JSON/base64
    expect(tryDecodeCursorPayload('nope')).toBeNull();
    // JSON not object
    const s1 = Buffer.from(JSON.stringify('str'), 'utf8').toString('base64url');
    expect(tryDecodeCursorPayload(s1)).toBeNull();
    // missing lastId
    const s2 = Buffer.from(JSON.stringify({ sortBy: 'createdAt', order: 'ASC', lastValue: 1 }), 'utf8').toString(
      'base64url',
    );
    expect(tryDecodeCursorPayload(s2)).toBeNull();
    // invalid uuid in lastId
    const s3 = Buffer.from(
      JSON.stringify({ sortBy: 'createdAt', order: 'ASC', lastValue: 1, lastId: 'bad' }),
      'utf8',
    ).toString('base64url');
    expect(tryDecodeCursorPayload(s3)).toBeNull();
  });
});
