// Shared cursor utilities
// - Simple ID cursor (base64url of UUID)
// - Extended payload cursor for keyset pagination with sort tuple

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
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
export type CursorPayload = {
  sortBy: 'createdAt' | 'price' | 'distance' | 'date';
  order: 'ASC' | 'DESC';
  lastValue: any;
  lastId: string;
};

export function encodeCursorPayload(p: CursorPayload): string {
  return Buffer.from(JSON.stringify(p), 'utf8').toString('base64url');
}

export function tryDecodeCursorPayload(cursor: string): CursorPayload | null {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    const payload = JSON.parse(decoded);
    if (!payload || typeof payload !== 'object') return null;
    if (typeof payload.lastId !== 'string' || !isUuid(payload.lastId)) return null;
    return payload as CursorPayload;
  } catch {
    return null;
  }
}
