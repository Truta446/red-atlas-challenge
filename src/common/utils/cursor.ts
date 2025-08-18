// Shared cursor utilities
// - Simple ID cursor (base64url of UUID)
// - Extended payload cursor for keyset pagination with sort tuple

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// Simple ID-based cursor helpers
export function encodeIdCursor(id: string): string {
  return Buffer.from(id, 'utf8').toString('base64url');
}

export function decodeIdCursor(cursor: string): string | null {
  try {
    const decoded: string = Buffer.from(cursor, 'base64url').toString('utf8');
    return isUuid(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

// Extended payload-based cursor helpers
export interface CursorPayload {
  sortBy: 'createdAt' | 'price' | 'distance' | 'date';
  order: 'ASC' | 'DESC';
  lastValue: unknown;
  lastId: string;
}

export function encodeCursorPayload(p: CursorPayload): string {
  return Buffer.from(JSON.stringify(p), 'utf8').toString('base64url');
}

export function tryDecodeCursorPayload(cursor: string): CursorPayload | null {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const raw: unknown = JSON.parse(decoded);
    if (!isRecord(raw)) return null;

    const sortBy = raw.sortBy;
    const order = raw.order;
    const lastId = raw.lastId;
    const lastValue = raw.lastValue;

    const validSort = sortBy === 'createdAt' || sortBy === 'price' || sortBy === 'distance' || sortBy === 'date';
    const validOrder = order === 'ASC' || order === 'DESC';

    if (!validSort || !validOrder) return null;
    if (typeof lastId !== 'string' || !isUuid(lastId)) return null;

    return { sortBy, order, lastId, lastValue } as CursorPayload;
  } catch {
    return null;
  }
}
