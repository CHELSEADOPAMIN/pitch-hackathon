import 'dotenv/config';

import { serve } from '@hono/node-server';

import { createShoppingAgentRunner } from './agent/shopping-agent';
import { createApp } from './app';
import { readServerConfig } from './config';
import { createDatabase } from './db/client';
import { DrizzleShoppingRepository } from './db/repository';
import { CheckoutService } from './domain/checkout-service';
import { InMemoryQuoteStore } from './domain/quote-store';
import { PinchClient } from './integrations/pinch';
import { OpenAIRealtimeClient } from './integrations/realtime';

export function createServer(environment: NodeJS.ProcessEnv = process.env) {
  const config = readServerConfig(environment);
  const database = createDatabase(config.DATABASE_URL);
  const repository = new DrizzleShoppingRepository(database.db);
  const pinch = new PinchClient({
    applicationId: config.PINCH_APPLICATION_ID,
    secretKey: config.PINCH_SECRET_KEY,
    baseUrl: config.PINCH_API_BASE_URL,
    apiVersion: config.PINCH_API_VERSION,
  });
  const realtime = new OpenAIRealtimeClient(config.OPENAI_API_KEY);
  const quotes = new InMemoryQuoteStore();
  const checkout = new CheckoutService(repository, quotes, pinch);
  const runShoppingAgent = createShoppingAgentRunner({
    repository,
    checkout,
    openaiApiKey: config.OPENAI_API_KEY,
  });
  const app = createApp({
    repository,
    pinch,
    realtime,
    runShoppingAgent,
  });

  return {
    app,
    close: database.close,
  };
}

export type { AppType } from './app';

const server = createServer();
const port = 8787;
const httpServer = serve(
  {
    fetch: server.app.fetch,
    port,
  },
  ({ port: listeningPort }) => {
    console.log(`Pinch Voice API listening on http://0.0.0.0:${listeningPort}`);
  },
);

async function close() {
  httpServer.close();
  await server.close();
}

process.once('SIGINT', () => void close());
process.once('SIGTERM', () => void close());
