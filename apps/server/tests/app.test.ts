import { describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app.js";
import { createInMemoryShoppingRepository } from "../src/domain/in-memory-repository.js";
import { createShoppingDomain } from "../src/domain/shopping-domain.js";

const setup = (pinchHealth = vi.fn(async () => true)) => {
  const run = vi.fn(async () => ({
    status: "not_found" as const,
    entity: "product" as const,
    query: "x",
  }));
  const issueClientSecret = vi.fn(async () => ({
    value: "ephemeral",
    expiresAt: 123,
  }));
  const domain = createShoppingDomain({
    repository: createInMemoryShoppingRepository(),
    customers: {
      createPayer: vi.fn(async () => ({ id: "payer_test" })),
      attachSource: vi.fn(async () => ({ id: "source_test" })),
    },
    createId: () => "user_test",
  });
  return {
    app: createApp({
      domain,
      agent: { run },
      realtime: { issueClientSecret },
      pinchHealth,
    }),
    issueClientSecret,
    run,
  };
};

describe("HTTP app", () => {
  it("reports application and authenticated Pinch health", async () => {
    const response = await setup().app.request("/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "ok",
      pinch: "ok",
    });
  });

  it("reports degraded health without leaking a Pinch outage error", async () => {
    const response = await setup(
      vi.fn(async () => Promise.reject(new Error("sensitive"))),
    ).app.request("/health");

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      status: "degraded",
      pinch: "unavailable",
    });
  });

  it("exposes login, payment-source, and realtime-token contracts", async () => {
    const { app, issueClientSecret } = setup();
    const login = await app.request("/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "alice" }),
    });
    await expect(login.json()).resolves.toEqual({
      userId: "user_test",
      username: "alice",
      hasPaymentMethod: false,
    });

    const source = await app.request("/api/payment-source", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "user_test", token: "temporary_token" }),
    });
    await expect(source.json()).resolves.toEqual({
      userId: "user_test",
      hasPaymentMethod: true,
    });

    const realtime = await app.request("/api/realtime-token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "user_test" }),
    });
    await expect(realtime.json()).resolves.toEqual({
      value: "ephemeral",
      expiresAt: 123,
    });
    expect(issueClientSecret).toHaveBeenCalledWith("user_test");
  });

  it("forwards self-contained agent requests and lists orders", async () => {
    const { app, run } = setup();
    const response = await app.request("/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "user_test", request: "find x" }),
    });
    await expect(response.json()).resolves.toEqual({
      status: "not_found",
      entity: "product",
      query: "x",
    });
    expect(run).toHaveBeenCalledWith({
      userId: "user_test",
      request: "find x",
    });

    const orders = await app.request("/api/orders");
    await expect(orders.json()).resolves.toEqual([]);
  });
});
