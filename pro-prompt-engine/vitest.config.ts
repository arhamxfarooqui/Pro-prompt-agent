import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@lib': path.resolve(__dirname, './lib') } },
  test: {
    environment: 'happy-dom',        // ~4x faster than jsdom to boot, and the DOM
                                     // surface we exercise (shadow roots, elementFromPoint,
                                     // MutationObserver) is fully supported
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    // tests/e2e/** runs under Playwright's own test runner (npm run
    // test:e2e), not Vitest — Playwright's `test`/`expect` are incompatible
    // with Vitest's. tests/bench/** is a standalone script (npx tsx …), not
    // a Vitest suite.
    include: ['tests/unit/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      // Only the files whose correctness is a safety property. A global
      // percentage across a UI-heavy repo measures nothing useful.
      include: ['lib/policy/**', 'lib/page/sensitive.ts', 'lib/agent/**', 'lib/schemas/**'],
      thresholds: { lines: 90, functions: 90, branches: 85 },
    },
  },
});
