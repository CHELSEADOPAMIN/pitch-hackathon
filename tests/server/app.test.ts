import { describe, expect, it, vi } from 'vitest';

import { createApp, type ServerDependencies } from '../../server/app';
import type {
  CreateOrderInput,
  ShoppingRepository,
} from '../../server/db/repository';
import type { CartItem, Order, Product, User } from '../../server/domain/types';
import type { PinchGateway } from '../../server/integrations/pinch';

const USER: User = {
  id: 'user_test',
  username: 'chelsea',
  pinchPayerId: null,
  pinchSourceId: null,
};

describe('Hono API contracts', () => {
  it('serves the staff dashboard from the API host', async () => {
    const response = await createApp(createDependencies()).request('/staff');
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(html).toContain('<title>Pinch Staff Orders</title>');
    expect(html).toContain('fetch("/api/orders"');
  });

  it('checks database and Pinch health', async () => {
    const dependencies = createDependencies();
    const response = await createApp(dependencies).request('/api/health');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      status: 'ok',
      dependencies: { database: 'ok', pinch: 'ok' },
    });
  });

  it('returns 503 when a health dependency is unavailable', async () => {
    const dependencies = createDependencies();
    dependencies.health.pinch.mockRejectedValueOnce(
      new Error('temporary outage'),
    );
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const response = await createApp(dependencies).request('/api/health');

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      ok: false,
      status: 'degraded',
      dependencies: { database: 'ok', pinch: 'unavailable' },
    });
    consoleError.mockRestore();
  });

  it('rejects malformed login input before touching Pinch', async () => {
    const dependencies = createDependencies();
    const response = await createApp(dependencies).request('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: ' ' }),
    });

    expect(response.status).toBe(400);
    expect(dependencies.pinch.createPayer).not.toHaveBeenCalled();
  });

  it('creates the first Pinch payer and returns only session facts', async () => {
    const dependencies = createDependencies();
    const response = await createApp(dependencies).request('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: USER.username }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      userId: USER.id,
      username: USER.username,
      hasPaymentMethod: false,
    });
    expect(dependencies.pinch.createPayer).toHaveBeenCalledWith(USER.username);
    expect(dependencies.repository.setPinchPayer).toHaveBeenCalledWith(
      USER.id,
      'pyr_test',
    );
  });

  it('forwards only a temporary token when binding a source', async () => {
    const dependencies = createDependencies({
      user: { ...USER, pinchPayerId: 'pyr_test' },
    });
    const response = await createApp(dependencies).request(
      '/api/payment-source',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '203.0.113.4, 10.0.0.1',
        },
        body: JSON.stringify({ userId: USER.id, token: 'tkn_test' }),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sourceId: 'src_test' });
    expect(dependencies.pinch.createSource).toHaveBeenCalledWith(
      'pyr_test',
      'tkn_test',
      '203.0.113.4',
    );
  });

  it('mints a user-bound ephemeral Realtime secret', async () => {
    const dependencies = createDependencies();
    const response = await createApp(dependencies).request(
      '/api/realtime-token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: USER.id }),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      value: 'ek_test',
      expiresAt: 1234,
    });
    expect(dependencies.realtime.createClientSecret).toHaveBeenCalledWith(
      USER.id,
    );
  });

  it('echoes the shopping correlation ID and passes the trace into the agent', async () => {
    const dependencies = createDependencies();
    const consoleInfo = vi
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);
    const response = await createApp(dependencies).request('/api/agent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-correlation-id': 'call_trace_123',
      },
      body: JSON.stringify({
        userId: USER.id,
        request: 'Add this product',
        traceId: 'call_trace_123',
      }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('x-correlation-id')).toBe('call_trace_123');
    expect(dependencies.runShoppingAgent).toHaveBeenCalledWith(
      expect.objectContaining({ traceId: 'call_trace_123' }),
    );
    expect(consoleInfo).toHaveBeenCalledTimes(2);
    consoleInfo.mockRestore();
  });

  it('serializes paid orders with an ISO timestamp', async () => {
    const dependencies = createDependencies();
    const response = await createApp(dependencies).request('/api/orders');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      orders: [
        expect.objectContaining({
          id: 'order_test',
          status: 'paid',
          createdAt: '2026-07-25T01:02:03.000Z',
        }),
      ],
    });
  });
});

function createDependencies(options: { user?: User } = {}) {
  const user = options.user ?? USER;
  const items: CartItem[] = [
    {
      productId: 'product_water',
      name: 'Water',
      priceCents: 250,
      qty: 1,
    },
  ];
  const order: Order = {
    id: 'order_test',
    userId: user.id,
    username: user.username,
    items,
    totalCents: 250,
    status: 'paid',
    checkoutQuoteId: 'quote_test',
    pinchPaymentId: 'pmt_test',
    createdAt: new Date('2026-07-25T01:02:03.000Z'),
  };

  const repository: ShoppingRepository = {
    findOrCreateUser: vi.fn(async () => ({ ...user })),
    getUser: vi.fn(async () => ({ ...user })),
    setPinchPayer: vi.fn(async (_userId, payerId) => ({
      ...user,
      pinchPayerId: payerId,
    })),
    setPinchSource: vi.fn(async (_userId, sourceId) => ({
      ...user,
      pinchSourceId: sourceId,
    })),
    listProducts: vi.fn(async (): Promise<Product[]> => []),
    searchProducts: vi.fn(async (): Promise<Product[]> => []),
    getProduct: vi.fn(async (): Promise<Product | null> => null),
    getCart: vi.fn(async () => items),
    addToCart: vi.fn(async () => {
      throw new Error('not used');
    }),
    removeFromCart: vi.fn(async () => {
      throw new Error('not used');
    }),
    createOrder: vi.fn(async (input: CreateOrderInput) => ({
      ...input,
      id: order.id,
      createdAt: order.createdAt,
    })),
    listOrders: vi.fn(async () => [order]),
  };
  const pinch: PinchGateway = {
    createPayer: vi.fn(async () => ({ id: 'pyr_test' })),
    createSource: vi.fn(async () => ({ id: 'src_test' })),
    charge: vi.fn(async () => ({ id: 'pmt_test', status: 'approved' })),
  };

  return {
    repository,
    pinch,
    health: {
      database: vi.fn(async () => undefined),
      pinch: vi.fn(async () => undefined),
    },
    realtime: {
      createClientSecret: vi.fn(async () => ({
        value: 'ek_test',
        expires_at: 1234,
      })),
    },
    runShoppingAgent: vi.fn(async () => ({
      status: 'completed' as const,
      action: 'cart' as const,
      facts: {},
    })),
  } satisfies ServerDependencies;
}
