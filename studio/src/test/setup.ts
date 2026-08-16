import '@testing-library/jest-dom/vitest';
import { randomFillSync } from 'node:crypto';

if (!globalThis.crypto?.getRandomValues) {
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: {
      getRandomValues<T extends ArrayBufferView | null>(buffer: T): T {
        if (buffer) randomFillSync(buffer);
        return buffer;
      },
    },
  });
}
