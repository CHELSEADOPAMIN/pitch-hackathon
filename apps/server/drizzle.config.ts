import { defineConfig } from "drizzle-kit";

import { loadEnvironment } from "./src/config/load-environment.js";

loadEnvironment();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run Drizzle commands");
}

export default defineConfig({
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL },
  schema: "./src/db/schema.ts",
  strict: true,
  verbose: true,
});
