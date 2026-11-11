import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Never let the tests touch a real database, even if .env sets DATABASE_URL
    env: { NODE_ENV: 'test', DATABASE_URL: 'memory://', UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_REST_TOKEN: '' },
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
