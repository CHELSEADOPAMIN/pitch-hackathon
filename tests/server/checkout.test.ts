import { describe, expect, it } from 'vitest';

import type {
  CreateOrderInput,
  ShoppingRepository,
} from '../../server/db/repository';
import { CheckoutService } from '../../server/domain/checkout-service';
import { InMemoryQuoteStore } from '../../server/domain/quote-store';
import type { CartItem, Order, Product, User } from '../../server/domain/types';
import type {
  PinchChargeInput,
  PinchChargeResult,
  PinchPaymentGateway,
} from '../../server/integrations/pinch';

const USER_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_USER_ID = '00000000-0000-4000-8000-000000000002';

const CART: CartItem[] = [
  {
    productId: 'milk',
    name: 'Milk',
    priceCents: 390,
    qty: 2,
  },
];

describe('two-phase checkout', () => {
  it('prepares an exact quote without charging', async () => {
    const harness = createHarness();

    const result = await harness.service.prepare(USER_ID);

    expect(result).toEqual({
      status: 'needs_confirmation',
      quoteId: 'q_test',
      items: CART,
      totalCents: 780,
    });
    expect(harness.gateway.calls).toHaveLength(0);
    expect(harness.repository.orders).toHaveLength(0);
  });

  it('charges once and creates an order only after approval', async () => {
    const harness = createHarness();
    const prepared = await harness.service.prepare(USER_ID);
    if (prepared.status !== 'needs_confirmation') {
      throw new Error('expected quote');
    }

    const result = await harness.service.confirm(USER_ID, prepared.quoteId);

    expect(result).toEqual({
      status: 'paid',
      paymentId: 'pmt_test',
      totalCents: 780,
    });
    expect(harness.gateway.calls).toEqual([
      expect.objectContaining({
        amountCents: 780,
        nonce: 'checkout-q_test',
      }),
    ]);
    expect(harness.repository.orders).toEqual([
      expect.objectContaining({
        checkoutQuoteId: 'q_test',
        pinchPaymentId: 'pmt_test',
        totalCents: 780,
        items: CART,
      }),
    ]);
    expect(harness.repository.cart).toEqual([]);
  });

  it('returns the first payment result for repeated confirmation', async () => {
    const harness = createHarness();
    const prepared = await harness.service.prepare(USER_ID);
    if (prepared.status !== 'needs_confirmation') {
      throw new Error('expected quote');
    }

    const first = await harness.service.confirm(USER_ID, prepared.quoteId);
    const repeated = await harness.service.confirm(USER_ID, prepared.quoteId);

    expect(repeated).toEqual(first);
    expect(harness.gateway.calls).toHaveLength(1);
    expect(harness.repository.orders).toHaveLength(1);
  });

  it('retries order persistence without charging again after approval', async () => {
    const harness = createHarness({ orderFailures: 1 });
    const prepared = await harness.service.prepare(USER_ID);
    if (prepared.status !== 'needs_confirmation') {
      throw new Error('expected quote');
    }

    const first = await harness.service.confirm(USER_ID, prepared.quoteId);
    const recovered = await harness.service.confirm(USER_ID, prepared.quoteId);

    expect(first).toEqual({
      status: 'error',
      reason: 'internal_server_error',
    });
    expect(recovered).toEqual({
      status: 'paid',
      paymentId: 'pmt_test',
      totalCents: 780,
    });
    expect(harness.gateway.calls).toHaveLength(1);
    expect(harness.repository.orders).toHaveLength(1);
    expect(harness.repository.cart).toEqual([]);
  });

  it('allows only one outbound charge for concurrent confirmation', async () => {
    const harness = createHarness();
    const prepared = await harness.service.prepare(USER_ID);
    if (prepared.status !== 'needs_confirmation') {
      throw new Error('expected quote');
    }

    const [first, second] = await Promise.all([
      harness.service.confirm(USER_ID, prepared.quoteId),
      harness.service.confirm(USER_ID, prepared.quoteId),
    ]);

    expect(harness.gateway.calls).toHaveLength(1);
    expect(harness.repository.orders).toHaveLength(1);
    expect([first.status, second.status].sort()).toEqual(['error', 'paid']);
  });

  it('rejects a quote if the cart has changed', async () => {
    const harness = createHarness();
    const prepared = await harness.service.prepare(USER_ID);
    if (prepared.status !== 'needs_confirmation') {
      throw new Error('expected quote');
    }
    harness.repository.cart = [{ ...CART[0], qty: 3 }];

    const result = await harness.service.confirm(USER_ID, prepared.quoteId);

    expect(result).toEqual({ status: 'error', reason: 'cart_changed' });
    expect(harness.gateway.calls).toHaveLength(0);
    expect(harness.repository.orders).toHaveLength(0);
  });

  it('rejects expired and cross-user quotes without charging', async () => {
    let now = 1_000;
    const harness = createHarness({
      quotes: new InMemoryQuoteStore({
        now: () => now,
        ttlMs: 100,
        createId: () => 'q_test',
      }),
    });
    const prepared = await harness.service.prepare(USER_ID);
    if (prepared.status !== 'needs_confirmation') {
      throw new Error('expected quote');
    }

    const wrongUser = await harness.service.confirm(
      OTHER_USER_ID,
      prepared.quoteId,
    );
    now = 1_101;
    const expired = await harness.service.confirm(USER_ID, prepared.quoteId);

    expect(wrongUser).toEqual({
      status: 'error',
      reason: 'quote_wrong_user',
    });
    expect(expired).toEqual({
      status: 'error',
      reason: 'quote_expired',
    });
    expect(harness.gateway.calls).toHaveLength(0);
  });

  it('does not create an order for a declined payment', async () => {
    const harness = createHarness({
      payment: { id: 'pmt_declined', status: 'declined' },
    });
    const prepared = await harness.service.prepare(USER_ID);
    if (prepared.status !== 'needs_confirmation') {
      throw new Error('expected quote');
    }

    const result = await harness.service.confirm(USER_ID, prepared.quoteId);

    expect(result).toEqual({
      status: 'error',
      reason: 'payment_declined',
    });
    expect(harness.repository.orders).toHaveLength(0);
  });
});

function createHarness(
  options: {
    quotes?: InMemoryQuoteStore;
    payment?: PinchChargeResult;
    orderFailures?: number;
  } = {},
) {
  const repository = new FakeRepository(options.orderFailures ?? 0);
  const gateway = new FakeGateway(
    options.payment ?? { id: 'pmt_test', status: 'approved' },
  );
  const quotes =
    options.quotes ?? new InMemoryQuoteStore({ createId: () => 'q_test' });
  const service = new CheckoutService(repository, quotes, gateway);
  return { repository, gateway, quotes, service };
}

class FakeGateway implements PinchPaymentGateway {
  readonly calls: PinchChargeInput[] = [];

  constructor(private readonly result: PinchChargeResult) {}

  async charge(input: PinchChargeInput) {
    this.calls.push(input);
    await Promise.resolve();
    return this.result;
  }
}

class FakeRepository implements ShoppingRepository {
  cart = CART.map((item) => ({ ...item }));
  orders: Order[] = [];
  private readonly users = new Map<string, User>([
    [
      USER_ID,
      {
        id: USER_ID,
        username: 'alex',
        pinchPayerId: 'pyr_test',
        pinchSourceId: 'src_test',
      },
    ],
    [
      OTHER_USER_ID,
      {
        id: OTHER_USER_ID,
        username: 'other',
        pinchPayerId: 'pyr_other',
        pinchSourceId: 'src_other',
      },
    ],
  ]);

  constructor(private orderFailures: number) {}

  async findOrCreateUser(username: string) {
    const found = [...this.users.values()].find(
      (user) => user.username === username,
    );
    if (!found) throw new Error('not implemented');
    return found;
  }

  async getUser(userId: string) {
    return this.users.get(userId) ?? null;
  }

  async setPinchPayer(userId: string, payerId: string) {
    const user = await this.requireUser(userId);
    user.pinchPayerId = payerId;
    return user;
  }

  async setPinchSource(userId: string, sourceId: string) {
    const user = await this.requireUser(userId);
    user.pinchSourceId = sourceId;
    return user;
  }

  async listProducts(): Promise<Product[]> {
    return [];
  }

  async searchProducts(): Promise<Product[]> {
    return [];
  }

  async getProduct(): Promise<Product | null> {
    return null;
  }

  async getCart() {
    return this.cart.map((item) => ({ ...item }));
  }

  async addToCart(): Promise<{
    product: Product;
    cart: CartItem[];
  }> {
    throw new Error('not implemented');
  }

  async removeFromCart(): Promise<{
    removed: CartItem;
    cart: CartItem[];
  }> {
    throw new Error('not implemented');
  }

  async clearCart() {
    this.cart = [];
  }

  async createOrder(input: CreateOrderInput) {
    if (this.orderFailures > 0) {
      this.orderFailures -= 1;
      throw new Error('temporary database failure');
    }
    const existing = this.orders.find(
      (order) => order.checkoutQuoteId === input.checkoutQuoteId,
    );
    if (existing) return existing;

    const order: Order = {
      ...input,
      id: `order_${this.orders.length + 1}`,
      createdAt: new Date(),
    };
    this.orders.push(order);
    return order;
  }

  async listOrders() {
    return this.orders;
  }

  private async requireUser(userId: string) {
    const user = this.users.get(userId);
    if (!user) throw new Error('user not found');
    return user;
  }
}
