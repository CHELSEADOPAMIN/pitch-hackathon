import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const migrationUrl = new URL(process.env.DATABASE_URL);
if (migrationUrl.port === '6543') {
  migrationUrl.port = '5432';
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './server/db/schema.ts',
  dbCredentials: {
    url: migrationUrl.toString(),
  },
  schemaFilter: ['codex_voice'],
  tablesFilter: ['users', 'products', 'carts', 'orders', 'merchants'],
  strict: true,
  verbose: true,
});
