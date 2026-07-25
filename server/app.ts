import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';

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
};

export function createApp(dependencies: ServerDependencies) {
  return new Hono()
    .get('/api/health', (context) => context.json({ ok: true }))
    .post(
      '/api/login',
      zValidator('json', loginRequestSchema),
      async (context) => {
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
        } catch {
          return context.json({ error: 'login_failed' }, 502);
        }
      },
    )
    .post(
      '/api/realtime-token',
      zValidator('json', realtimeTokenRequestSchema),
      async (context) => {
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
        } catch {
          return context.json({ error: 'realtime_token_failed' }, 502);
        }
      },
    )
    .post(
      '/api/payment-source',
      zValidator('json', paymentSourceRequestSchema),
      async (context) => {
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
        } catch {
          return context.json({ error: 'payment_source_failed' }, 502);
        }
      },
    )
    .post(
      '/api/agent',
      zValidator('json', agentRequestSchema),
      async (context) => {
        try {
          return context.json(
            await dependencies.runShoppingAgent(context.req.valid('json')),
          );
        } catch {
          return context.json({
            status: 'error' as const,
            reason: 'agent_failed',
          });
        }
      },
    )
    .get('/api/orders', async (context) => {
      const orders = await dependencies.repository.listOrders();
      return context.json(
        ordersResponseSchema.parse({
          orders: orders.map((order) => ({
            ...order,
            createdAt: order.createdAt.toISOString(),
          })),
        }),
      );
    });
}

export type AppType = ReturnType<typeof createApp>;
