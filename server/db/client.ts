import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { schema } from './schema';

export function createDatabase(databaseUrl: string) {
  const client = postgres(databaseUrl, {
    max: 5,
    prepare: false,
  });
  const db = drizzle(client, { schema });

  return {
    db,
    healthCheck: async () => {
      await client`select 1`;
    },
    close: () => client.end(),
  };
}

export type Database = ReturnType<typeof createDatabase>['db'];
