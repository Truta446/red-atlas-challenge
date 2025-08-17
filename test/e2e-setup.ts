// Ensure global crypto is available in Jest Node environment
// Node 16+: use global webcrypto from 'crypto'
// Node 22 should have globalThis.crypto, but ts-jest may isolate envs
import { webcrypto } from 'crypto';

// Guard in case already defined
if (!(globalThis as any).crypto) {
  (globalThis as any).crypto = webcrypto as any;
}
