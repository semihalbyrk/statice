import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 30000,
    hookTimeout: 30000,
    // Run test files sequentially to prevent DB race conditions across files.
    // Tests within a file still run in their declared order.
    fileParallelism: false,
    // Retry tests once on transient infrastructure failures (socket hang-up,
    // connection reset). Logic failures still fail deterministically.
    retry: 2,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.js'],
      exclude: ['src/__tests__/**', 'src/index.js', 'prisma/**'],
    },
  },
});
