import { describe, expect, it } from 'vitest';

import {
  agentRequestSchema,
  agentResultSchema,
  cartItemSchema,
  checkoutConfirmationSchema,
  orderSchema,
} from '../../src/contracts/api';

describe('shared API contracts', () => {
  it('accepts each factual AgentResult state', () => {
    expect(
      agentResultSchema.parse({
        status: 'ambiguous',
        candidates: [
          { productId: 'milk', name: 'Milk' },
          { productId: 'water', name: 'Water' },
        ],
      }),
    ).toMatchObject({ status: 'ambiguous' });

    expect(
      agentResultSchema.parse({
        status: 'needs_confirmation',
        quoteId: 'q_1',
        items: [{ productId: 'milk', name: 'Milk', priceCents: 390, qty: 1 }],
        totalCents: 390,
      }),
    ).toMatchObject({ status: 'needs_confirmation', totalCents: 390 });
  });

  it('requires explicit true confirmation and a matching API shape', () => {
    expect(
      checkoutConfirmationSchema.safeParse({
        quoteId: 'q_1',
        confirmed: false,
      }).success,
    ).toBe(false);
    expect(
      agentRequestSchema.parse({
        userId: 'user_1',
        request: 'The customer explicitly confirmed quote q_1',
        checkoutConfirmation: { quoteId: 'q_1', confirmed: true },
      }),
    ).toMatchObject({ checkoutConfirmation: { confirmed: true } });
  });

  it('rejects fractional cents in carts and orders', () => {
    expect(
      cartItemSchema.safeParse({
        productId: 'milk',
        name: 'Milk',
        priceCents: 3.9,
        qty: 1,
      }).success,
    ).toBe(false);
    expect(
      orderSchema.safeParse({
        id: 'order_1',
        userId: 'user_1',
        username: 'alex',
        items: [],
        totalCents: 3.9,
        status: 'paid',
        checkoutQuoteId: 'q_1',
        pinchPaymentId: 'pmt_1',
        createdAt: new Date().toISOString(),
      }).success,
    ).toBe(false);
  });
});
