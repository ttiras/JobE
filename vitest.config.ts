// vitest.config.ts
import 'dotenv/config';
import { defineConfig } from 'vitest/config';

const isStaging =
  process.env.DOTENV_CONFIG_PATH?.includes('staging') ||
  process.env.NODE_ENV === 'staging' ||
  process.env.CI === 'true';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: true,

    // Avoid multiple files competing for auth in staging
    fileParallelism: !isStaging,            // single worker processes files sequentially when staging
    sequence: { concurrent: false },

    // Give staging more breathing room
    testTimeout: isStaging ? 90_000 : 40_000,
    hookTimeout: isStaging ? 90_000 : 40_000,

    // Reduce thread pool to a single worker in staging to cut down concurrent sign-ins
    pool: 'threads',
    poolOptions: {
      threads: {
        minThreads: isStaging ? 1 : undefined,
        maxThreads: isStaging ? 1 : undefined,
      },
    },

    setupFiles: ['tests/setup/warm-auth.ts'],
  },
});
