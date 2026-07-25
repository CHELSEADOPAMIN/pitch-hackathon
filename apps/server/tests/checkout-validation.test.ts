import { describe, expect, it, vi } from "vitest";

import { createInMemoryShoppingRepository } from "../src/domain/in-memory-repository.js";
import { createShoppingDomain } from "../src/domain/shopping-domain.js";

const product = {
  id: "product_milk",
  merchantId: "merchant_demo",
  name: "Demo Milk",
  priceCents: 499,
  description: "One litre",
};

describe("checkout validation", () => {
  it("returns the paid result for a duplicate confirmation even after quote expiry", async () => {
    let clock = Date.parse("2026-07-25T12:00:00.000Z");
    const charge = vi.fn(async () => ({
      id: "payment_1",
      status: "approved" as const,
    }));
    const repository = createInMemoryShoppingRepository({
      products: [product],
      users: [
        {
          id: "user_alice",
          username: "alice",
          pinchPayerId: "payer_alice",
          pinchSourceId: "source_alice",
        },
      ],
    });
    const domain = createShoppingDomain({
      repository,
      payments: { charge },
      createId: () => "quote_fixed",
      now: () => new Date(clock),
    });
    await domain.addToCart("user_alice", product.id, 1);
    const quote = await domain.prepareCheckout("user_alice");
    if (quote.status !== "needs_confirmation")
      throw new Error("quote expected");
    const paid = await domain.confirmCheckout("user_alice", quote.quoteId);
    clock += 6 * 60 * 1_000;

    await expect(
      domain.confirmCheckout("user_alice", quote.quoteId),
    ).resolves.toEqual(paid);
    expect(charge).toHaveBeenCalledTimes(1);
  });

  it("rejects a quote owned by another user without charging", async () => {
    const charge = vi.fn(async () => ({
      id: "payment_1",
      status: "approved" as const,
    }));
    const repository = createInMemoryShoppingRepository({
      products: [product],
      users: [
        { id: "user_alice", username: "alice" },
        {
          id: "user_bob",
          username: "bob",
          pinchPayerId: "payer_bob",
          pinchSourceId: "source_bob",
        },
      ],
    });
    const domain = createShoppingDomain({
      repository,
      payments: { charge },
      createId: () => "q1",
    });
    await domain.addToCart("user_alice", product.id, 1);
    const quote = await domain.prepareCheckout("user_alice");
    if (quote.status !== "needs_confirmation")
      throw new Error("quote expected");

    await expect(
      domain.confirmCheckout("user_bob", quote.quoteId),
    ).resolves.toEqual({
      status: "error",
      reason: "quote_owner_mismatch",
    });
    expect(charge).not.toHaveBeenCalled();
  });

  it("rejects a changed cart snapshot without charging", async () => {
    const charge = vi.fn(async () => ({
      id: "payment_1",
      status: "approved" as const,
    }));
    const repository = createInMemoryShoppingRepository({
      products: [product],
      users: [
        {
          id: "user_alice",
          username: "alice",
          pinchPayerId: "payer_alice",
          pinchSourceId: "source_alice",
        },
      ],
    });
    const domain = createShoppingDomain({
      repository,
      payments: { charge },
      createId: () => "q1",
    });
    await domain.addToCart("user_alice", product.id, 1);
    const quote = await domain.prepareCheckout("user_alice");
    if (quote.status !== "needs_confirmation")
      throw new Error("quote expected");
    await domain.addToCart("user_alice", product.id, 1);

    await expect(
      domain.confirmCheckout("user_alice", quote.quoteId),
    ).resolves.toEqual({
      status: "error",
      reason: "cart_changed",
    });
    expect(charge).not.toHaveBeenCalled();
  });

  it("rejects expired quotes and users without a persistent payment source", async () => {
    let clock = Date.parse("2026-07-25T12:00:00.000Z");
    const charge = vi.fn(async () => ({
      id: "payment_1",
      status: "approved" as const,
    }));
    const repository = createInMemoryShoppingRepository({
      products: [product],
      users: [
        { id: "user_alice", username: "alice", pinchPayerId: "payer_alice" },
      ],
    });
    const domain = createShoppingDomain({
      repository,
      payments: { charge },
      createId: () => "q1",
      now: () => new Date(clock),
    });
    await domain.addToCart("user_alice", product.id, 1);
    const quote = await domain.prepareCheckout("user_alice");
    if (quote.status !== "needs_confirmation")
      throw new Error("quote expected");

    await expect(
      domain.confirmCheckout("user_alice", quote.quoteId),
    ).resolves.toEqual({
      status: "error",
      reason: "payment_source_required",
    });
    clock += 6 * 60 * 1_000;
    await expect(
      domain.confirmCheckout("user_alice", quote.quoteId),
    ).resolves.toEqual({
      status: "error",
      reason: "quote_expired",
    });
    expect(charge).not.toHaveBeenCalled();
  });

  it("retries order persistence after a charge without charging twice", async () => {
    const charge = vi.fn(async () => ({
      id: "payment_1",
      status: "approved" as const,
    }));
    const memory = createInMemoryShoppingRepository({
      products: [product],
      users: [
        {
          id: "user_alice",
          username: "alice",
          pinchPayerId: "payer_alice",
          pinchSourceId: "source_alice",
        },
      ],
    });
    let firstAttempt = true;
    const repository = {
      ...memory,
      createOrderOnce: vi.fn(
        async (order: Parameters<typeof memory.createOrderOnce>[0]) => {
          if (firstAttempt) {
            firstAttempt = false;
            throw new Error("temporary database outage");
          }
          return memory.createOrderOnce(order);
        },
      ),
    };
    const domain = createShoppingDomain({
      repository,
      payments: { charge },
      createId: () => "q1",
    });
    await domain.addToCart("user_alice", product.id, 1);
    const quote = await domain.prepareCheckout("user_alice");
    if (quote.status !== "needs_confirmation")
      throw new Error("quote expected");

    await expect(
      domain.confirmCheckout("user_alice", quote.quoteId),
    ).resolves.toEqual({
      status: "error",
      reason: "checkout_failed",
    });
    await expect(
      domain.confirmCheckout("user_alice", quote.quoteId),
    ).resolves.toEqual({
      status: "paid",
      paymentId: "payment_1",
      totalCents: 499,
    });
    expect(charge).toHaveBeenCalledTimes(1);
    expect(await domain.listOrders()).toHaveLength(1);
  });

  it("does not expose an unknown provider status in the domain error", async () => {
    const repository = createInMemoryShoppingRepository({
      products: [product],
      users: [
        {
          id: "user_alice",
          username: "alice",
          pinchPayerId: "payer_alice",
          pinchSourceId: "source_alice",
        },
      ],
    });
    const domain = createShoppingDomain({
      repository,
      payments: {
        charge: async () => ({
          id: "payment_1",
          status: "future-valid-status",
        }),
      },
      createId: () => "q1",
    });
    await domain.addToCart("user_alice", product.id, 1);
    const quote = await domain.prepareCheckout("user_alice");
    if (quote.status !== "needs_confirmation")
      throw new Error("quote expected");

    await expect(
      domain.confirmCheckout("user_alice", quote.quoteId),
    ).resolves.toEqual({
      status: "error",
      reason: "payment_not_approved",
    });
  });
});
