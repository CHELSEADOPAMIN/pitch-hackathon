import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema.js";

export const createDatabase = (connectionString: string) => {
  const hostname = new URL(connectionString).hostname;
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1";
  const pool = new Pool({
    connectionString,
    max: 5,
    ...(isLocal ? {} : { ssl: { rejectUnauthorized: false } }),
  });
  return {
    db: drizzle(pool, { schema }),
    close: () => pool.end(),
  };
};

export type Database = ReturnType<typeof createDatabase>["db"];
