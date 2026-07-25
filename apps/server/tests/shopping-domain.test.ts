import { describe, expect, it, vi } from "vitest";

import { createShoppingDomain } from "../src/domain/shopping-domain.js";
import { createInMemoryShoppingRepository } from "../src/domain/in-memory-repository.js";

describe("ShoppingDomain", () => {
  it("adds a product using the repository price as the authority", async () => {
    const repository = createInMemoryShoppingRepository({
      products: [
        {
          id: "product_milk",
          merchantId: "merchant_demo",
          name: "Demo Milk 1L",
          priceCents: 499,
          description: "Full cream milk",
        },
      ],
      users: [{ id: "user_alice", username: "alice" }],
    });
    const domain = createShoppingDomain({ repository });

    const result = await domain.addToCart("user_alice", "product_milk", 2);

    expect(result).toEqual({
      status: "completed",
      action: "added",
      facts: {
        cartCount: 2,
        item: {
          productId: "product_milk",
          name: "Demo Milk 1L",
          priceCents: 499,
          qty: 2,
        },
        totalCents: 998,
      },
    });
  });

  it("returns a typed not_found result for an unknown product", async () => {
    const repository = createInMemoryShoppingRepository({
      users: [{ id: "user_alice", username: "alice" }],
    });
    const domain = createShoppingDomain({ repository });

    const result = await domain.addToCart("user_alice", "missing", 1);

    expect(result).toEqual({
      status: "not_found",
      entity: "product",
      query: "missing",
    });
  });

  it("prepares a five-minute checkout quote from the cart snapshot", async () => {
    const repository = createInMemoryShoppingRepository({
      products: [
        {
          id: "product_milk",
          merchantId: "merchant_demo",
          name: "Demo Milk 1L",
          priceCents: 499,
          description: "Full cream milk",
        },
      ],
      users: [{ id: "user_alice", username: "alice" }],
    });
    const domain = createShoppingDomain({
      repository,
      createId: () => "quote_fixed",
      now: () => new Date("2026-07-25T12:00:00.000Z"),
    });
    await domain.addToCart("user_alice", "product_milk", 2);

    const result = await domain.prepareCheckout("user_alice");

    expect(result).toEqual({
      status: "needs_confirmation",
      quoteId: "quote_fixed",
      expiresAt: "2026-07-25T12:05:00.000Z",
      items: [
        {
          productId: "product_milk",
          name: "Demo Milk 1L",
          priceCents: 499,
          qty: 2,
        },
      ],
      totalCents: 998,
    });
  });

  it("coalesces duplicate checkout confirmations into one charge and one order", async () => {
    const repository = createInMemoryShoppingRepository({
      products: [
        {
          id: "product_milk",
          merchantId: "merchant_demo",
          name: "Demo Milk 1L",
          priceCents: 499,
          description: "Full cream milk",
        },
      ],
      users: [
        {
          id: "user_alice",
          username: "alice",
          pinchPayerId: "payer_alice",
          pinchSourceId: "source_alice",
        },
      ],
    });
    const charge = vi.fn(async () => ({
      id: "payment_1",
      status: "approved" as const,
    }));
    const domain = createShoppingDomain({
      repository,
      payments: { charge },
      createId: () => "quote_fixed",
      now: () => new Date("2026-07-25T12:00:00.000Z"),
    });
    await domain.addToCart("user_alice", "product_milk", 1);
    const prepared = await domain.prepareCheckout("user_alice");
    if (prepared.status !== "needs_confirmation")
      throw new Error("quote expected");

    const [first, duplicate] = await Promise.all([
      domain.confirmCheckout("user_alice", prepared.quoteId),
      domain.confirmCheckout("user_alice", prepared.quoteId),
    ]);

    expect(first).toEqual({
      status: "paid",
      paymentId: "payment_1",
      totalCents: 499,
    });
    expect(duplicate).toEqual(first);
    expect(charge).toHaveBeenCalledTimes(1);
    expect(await domain.listOrders()).toHaveLength(1);
  });

  it("removes an item and returns the resulting cart facts", async () => {
    const repository = createInMemoryShoppingRepository({
      products: [
        {
          id: "product_milk",
          merchantId: "merchant_demo",
          name: "Demo Milk 1L",
          priceCents: 499,
          description: "Full cream milk",
        },
      ],
      users: [{ id: "user_alice", username: "alice" }],
    });
    const domain = createShoppingDomain({ repository });
    await domain.addToCart("user_alice", "product_milk", 2);

    const removed = await domain.removeFromCart("user_alice", "product_milk");

    expect(removed).toEqual({
      status: "completed",
      action: "removed",
      facts: { cartCount: 0, removedProductId: "product_milk", totalCents: 0 },
    });
    expect(await domain.getCart("user_alice")).toEqual({
      status: "completed",
      action: "cart",
      facts: { items: [], cartCount: 0, totalCents: 0 },
    });
  });

  it("marks multiple product matches as ambiguous instead of guessing", async () => {
    const repository = createInMemoryShoppingRepository({
      products: [
        {
          id: "milk_full",
          merchantId: "merchant_demo",
          name: "Full Cream Milk",
          priceCents: 320,
          description: "One litre",
        },
        {
          id: "milk_chocolate",
          merchantId: "merchant_demo",
          name: "Chocolate Milk",
          priceCents: 480,
          description: "600 ml",
        },
      ],
      users: [{ id: "user_alice", username: "alice" }],
    });
    const domain = createShoppingDomain({ repository });

    const result = await domain.searchProducts("milk");

    expect(result).toEqual({
      status: "ambiguous",
      candidates: [
        {
          productId: "milk_chocolate",
          name: "Chocolate Milk",
          priceCents: 480,
        },
        { productId: "milk_full", name: "Full Cream Milk", priceCents: 320 },
      ],
    });
  });

  it("creates one Pinch payer on first mock login and reuses it later", async () => {
    const repository = createInMemoryShoppingRepository();
    const createPayer = vi.fn(
      async (input: { firstName: string; emailAddress: string }) => {
        expect(input.firstName).toBe("Alice 李");
        return { id: "payer_alice" };
      },
    );
    const domain = createShoppingDomain({
      repository,
      customers: {
        createPayer,
        attachSource: vi.fn(),
      },
      createId: () => "user_fixed",
    });

    const first = await domain.login(" Alice 李 ");
    const second = await domain.login(" Alice 李 ");

    expect(first).toEqual({
      userId: "user_fixed",
      username: "Alice 李",
      hasPaymentMethod: false,
    });
    expect(second).toEqual(first);
    expect(createPayer).toHaveBeenCalledTimes(1);
    expect(createPayer.mock.calls[0]?.[0]?.emailAddress).toMatch(
      /^pinch\.voice\+[a-f0-9]{16}@example\.com$/,
    );
  });

  it("exchanges a temporary card token for a persistent payer source", async () => {
    const repository = createInMemoryShoppingRepository({
      users: [
        { id: "user_alice", username: "alice", pinchPayerId: "payer_alice" },
      ],
    });
    const attachSource = vi.fn(async () => ({ id: "source_alice" }));
    const domain = createShoppingDomain({
      repository,
      customers: { createPayer: vi.fn(), attachSource },
    });

    const result = await domain.attachPaymentSource(
      "user_alice",
      "temporary_token",
    );

    expect(result).toEqual({ userId: "user_alice", hasPaymentMethod: true });
    expect(attachSource).toHaveBeenCalledWith({
      payerId: "payer_alice",
      token: "temporary_token",
    });
  });
});
