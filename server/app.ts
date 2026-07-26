import { randomUUID } from 'node:crypto';

import { zValidator } from '@hono/zod-validator';
import { Hono, type Context } from 'hono';

import {
  agentRequestSchema,
  loginRequestSchema,
  loginResponseSchema,
  ordersResponseSchema,
  paymentSourceRequestSchema,
  paymentSourceResponseSchema,
  realtimeTokenRequestSchema,
  realtimeTokenResponseSchema,
} from '../src/contracts/api';
import type { ShoppingRepository } from './db/repository';
import { type AgentRequest, type AgentResult } from './domain/types';
import type { PinchGateway } from './integrations/pinch';
import type {
  OpenAIRealtimeClient,
  RealtimeSecret,
} from './integrations/realtime';

export type ServerDependencies = {
  repository: ShoppingRepository;
  pinch: PinchGateway;
  realtime: Pick<OpenAIRealtimeClient, 'createClientSecret'>;
  runShoppingAgent(input: AgentRequest): Promise<AgentResult>;
  health: {
    database(): Promise<void>;
    pinch(): Promise<void>;
  };
};

export function createApp(dependencies: ServerDependencies) {
  return new Hono()
    .get('/api/health', async (context) => {
      const correlationId = beginRequest(context);
      const [database, pinch] = await Promise.allSettled([
        dependencies.health.database(),
        dependencies.health.pinch(),
      ]);
      const dependenciesStatus = {
        database: database.status === 'fulfilled' ? 'ok' : 'unavailable',
        pinch: pinch.status === 'fulfilled' ? 'ok' : 'unavailable',
      } as const;
      const ok =
        database.status === 'fulfilled' && pinch.status === 'fulfilled';
      if (!ok) {
        logRouteError(
          '/api/health',
          503,
          correlationId,
          database.status === 'rejected'
            ? database.reason
            : pinch.status === 'rejected'
              ? pinch.reason
              : new Error('Unknown health-check failure'),
        );
      }
      return context.json(
        {
          ok,
          status: ok ? ('ok' as const) : ('degraded' as const),
          dependencies: dependenciesStatus,
        },
        ok ? 200 : 503,
      );
    })
    .post(
      '/api/login',
      zValidator('json', loginRequestSchema),
      async (context) => {
        const correlationId = beginRequest(context);
        try {
          let user = await dependencies.repository.findOrCreateUser(
            context.req.valid('json').username,
          );
          if (!user.pinchPayerId) {
            const payer = await dependencies.pinch.createPayer(user.username);
            user = await dependencies.repository.setPinchPayer(
              user.id,
              payer.id,
            );
          }
          return context.json(
            loginResponseSchema.parse({
              userId: user.id,
              username: user.username,
              hasPaymentMethod: Boolean(user.pinchSourceId),
            }),
          );
        } catch (error) {
          logRouteError('/api/login', 502, correlationId, error);
          return context.json({ error: 'login_failed' }, 502);
        }
      },
    )
    .post(
      '/api/realtime-token',
      zValidator('json', realtimeTokenRequestSchema),
      async (context) => {
        const correlationId = beginRequest(context);
        try {
          const secret: RealtimeSecret =
            await dependencies.realtime.createClientSecret(
              context.req.valid('json').userId,
            );
          return context.json(
            realtimeTokenResponseSchema.parse({
              value: secret.value,
              expiresAt: secret.expires_at,
            }),
          );
        } catch (error) {
          logRouteError('/api/realtime-token', 502, correlationId, error);
          return context.json({ error: 'realtime_token_failed' }, 502);
        }
      },
    )
    .post(
      '/api/payment-source',
      zValidator('json', paymentSourceRequestSchema),
      async (context) => {
        const correlationId = beginRequest(context);
        try {
          const { userId, token } = context.req.valid('json');
          const user = await dependencies.repository.getUser(userId);
          if (!user?.pinchPayerId) {
            return context.json({ error: 'payment_payer_missing' }, 400);
          }

          const forwardedFor = context.req
            .header('x-forwarded-for')
            ?.split(',')[0]
            ?.trim();
          const source = await dependencies.pinch.createSource(
            user.pinchPayerId,
            token,
            forwardedFor || '127.0.0.1',
          );
          await dependencies.repository.setPinchSource(user.id, source.id);
          return context.json(
            paymentSourceResponseSchema.parse({ sourceId: source.id }),
          );
        } catch (error) {
          logRouteError('/api/payment-source', 502, correlationId, error);
          return context.json({ error: 'payment_source_failed' }, 502);
        }
      },
    )
    .post(
      '/api/agent',
      zValidator('json', agentRequestSchema),
      async (context) => {
        const correlationId = beginRequest(context);
        try {
          return context.json(
            await dependencies.runShoppingAgent(context.req.valid('json')),
          );
        } catch (error) {
          logRouteError('/api/agent', 500, correlationId, error);
          return context.json({
            status: 'error' as const,
            reason: 'agent_failed',
          });
        }
      },
    )
    .get('/api/orders', async (context) => {
      const correlationId = beginRequest(context);
      try {
        const orders = await dependencies.repository.listOrders();
        return context.json(
          ordersResponseSchema.parse({
            orders: orders.map((order) => ({
              ...order,
              createdAt: order.createdAt.toISOString(),
            })),
          }),
        );
      } catch (error) {
        logRouteError('/api/orders', 500, correlationId, error);
        return context.json({ error: 'orders_failed' }, 500);
      }
    });
}

export type AppType = ReturnType<typeof createApp>;

function beginRequest(context: Context) {
  const supplied = context.req.header('x-correlation-id');
  const correlationId =
    supplied && /^[A-Za-z0-9._-]{8,100}$/.test(supplied)
      ? supplied
      : randomUUID();
  context.header('x-correlation-id', correlationId);
  return correlationId;
}

function logRouteError(
  route: string,
  status: number,
  correlationId: string,
  error: unknown,
) {
  console.error(
    JSON.stringify({
      level: 'error',
      route,
      status,
      correlationId,
      error: sanitizedError(error),
    }),
  );
}

function sanitizedError(error: unknown) {
  const name = error instanceof Error ? error.name : 'UnknownError';
  const rawMessage =
    error instanceof Error ? error.message : 'An unknown error occurred';
  const message = rawMessage
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/\b(?:sk|pk|app|tkn|ek)_[A-Za-z0-9_-]+\b/g, '[redacted]')
    .replace(/\b\d{12,19}\b/g, '[redacted]')
    .replace(
      /(["']?(?:cvc|cardNumber|access_token|client_secret)["']?\s*[:=]\s*)[^,}\s]+/gi,
      '$1[redacted]',
    )
    .slice(0, 500);
  return { name, message };
}
