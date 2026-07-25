import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import type { RealtimeClient } from "./adapters/openai-realtime.js";
import type { ShoppingAgent } from "./agent/terra-shopping-agent.js";
import type { ShoppingDomain } from "./domain/shopping-domain.js";

const loginSchema = z
  .object({ username: z.string().trim().min(1).max(64) })
  .strict();
const userSchema = z.object({ userId: z.string().min(1).max(128) }).strict();
const paymentSourceSchema = userSchema
  .extend({ token: z.string().trim().min(1).max(2_048) })
  .strict();
const checkoutConfirmationSchema = z
  .object({ quoteId: z.string().min(1).max(128), confirmed: z.literal(true) })
  .strict();
const agentSchema = userSchema
  .extend({
    request: z.string().trim().min(1).max(4_000),
    imageBase64: z.string().min(1).max(3_000_000).optional(),
    checkoutConfirmation: checkoutConfirmationSchema.optional(),
  })
  .strict();

type Dependencies = {
  domain: ShoppingDomain;
  agent: ShoppingAgent;
  realtime: RealtimeClient;
  pinchHealth: () => Promise<boolean>;
};

export const createApp = (dependencies: Dependencies) => {
  const app = new Hono().onError((_error, context) =>
    context.json({ error: "internal_error" }, 500),
  );

  return app
    .get("/health", async (context) => {
      const pinchIsHealthy = await dependencies
        .pinchHealth()
        .catch(() => false);
      return pinchIsHealthy
        ? context.json({ status: "ok" as const, pinch: "ok" as const })
        : context.json(
            { status: "degraded" as const, pinch: "unavailable" as const },
            503,
          );
    })
    .post("/api/login", zValidator("json", loginSchema), async (context) => {
      const result = await dependencies.domain.login(
        context.req.valid("json").username,
      );
      return context.json(result);
    })
    .post(
      "/api/realtime-token",
      zValidator("json", userSchema),
      async (context) => {
        const { userId } = context.req.valid("json");
        return context.json(
          await dependencies.realtime.issueClientSecret(userId),
        );
      },
    )
    .post(
      "/api/payment-source",
      zValidator("json", paymentSourceSchema),
      async (context) => {
        const { userId, token } = context.req.valid("json");
        return context.json(
          await dependencies.domain.attachPaymentSource(userId, token),
        );
      },
    )
    .post("/api/agent", zValidator("json", agentSchema), async (context) => {
      const body = context.req.valid("json");
      const result = await dependencies.agent.run({
        userId: body.userId,
        request: body.request,
        ...(body.imageBase64 ? { imageBase64: body.imageBase64 } : {}),
        ...(body.checkoutConfirmation
          ? { checkoutConfirmation: body.checkoutConfirmation }
          : {}),
      });
      return context.json(result);
    })
    .get("/api/orders", async (context) => {
      const orders = await dependencies.domain.listOrders();
      return context.json(
        orders.map((order) => ({
          ...order,
          createdAt: order.createdAt.toISOString(),
        })),
      );
    });
};

export type AppType = ReturnType<typeof createApp>;
