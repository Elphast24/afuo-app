import { defineConfig } from 'drizzle-kit';

// Used only for `drizzle-kit generate` (SQL migration files); migrations are applied by src/db/migrate.ts
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  verbose: true,
  strict: true,
});
