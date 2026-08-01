import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

/**
 * Shared test setup.
 *
 * Both hooks exist to stop state leaking between tests. `sessionStorage` in
 * particular is real in jsdom and persists across a file, so an authenticated
 * test would silently authenticate the next one — and a test that passes for a
 * reason the test did not establish is worse than no test.
 */
afterEach(() => {
  cleanup();
});

beforeEach(() => {
  sessionStorage.clear();
});
