import { createOpenAI } from "@ai-sdk/openai";
import { serve } from "@hono/node-server";

import { createOpenAiRealtimeClient } from "./adapters/openai-realtime.js";
import { createPinchClient } from "./adapters/pinch-client.js";
import { createTerraShoppingAgent } from "./agent/terra-shopping-agent.js";
import { createApp } from "./app.js";
import { loadServerConfig } from "./config/server-config.js";
import { createDatabase } from "./db/client.js";
import { createPostgresShoppingRepository } from "./db/postgres-shopping-repository.js";
import { createShoppingDomain } from "./domain/shopping-domain.js";

const config = loadServerConfig();
const database = createDatabase(config.databaseUrl);
const repository = createPostgresShoppingRepository(database.db);
const pinch = createPinchClient({
  applicationId: config.pinchApplicationId,
  secretKey: config.pinchSecretKey,
  apiBaseUrl: config.pinchApiBaseUrl,
  apiVersion: config.pinchApiVersion,
});
const domain = createShoppingDomain({
  repository,
  customers: pinch,
  payments: pinch,
});
const realtime = createOpenAiRealtimeClient({
  apiKey: config.openAiApiKey,
  model: config.openAiRealtimeModel,
});
const openai = createOpenAI({ apiKey: config.openAiApiKey });
const agent = createTerraShoppingAgent({
  domain,
  model: openai.responses(config.openAiVisionModel),
});
const app = createApp({
  domain,
  agent,
  realtime,
  pinchHealth: () => pinch.health(),
});
const server = serve({
  fetch: app.fetch,
  hostname: config.hostname,
  port: config.port,
});

const shutdown = () => {
  server.close(() => {
    void database.close().finally(() => process.exit(0));
  });
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
