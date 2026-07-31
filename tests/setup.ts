import '@testing-library/jest-dom/vitest';
import { beforeAll } from 'vitest';

beforeAll(() => {
  process.env.HOME = 'C:\\Users\\testuser';
  process.env.USERPROFILE = 'C:\\Users\\testuser';
  process.env.HOMEDRIVE = 'C:';
  process.env.HOMEPATH = '\\Users\\testuser';

  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      disconnect() {}
      unobserve() {}
    } as typeof ResizeObserver;
  }
});
