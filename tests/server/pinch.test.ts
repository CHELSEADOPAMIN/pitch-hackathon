import { describe, expect, it } from 'vitest';

import { PinchClient } from '../../server/integrations/pinch';

describe('PinchClient', () => {
  it('uses form OAuth, fixed API version, integer cents and stable nonce', async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const fetch = async (input: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(input), init: init ?? {} });
      if (String(input).includes('/connect/token')) {
        return jsonResponse({
          access_token: 'access_test',
          expires_in: 3600,
        });
      }
      return jsonResponse({ id: 'pmt_test', status: 'approved' }, 201);
    };
    const pinch = new PinchClient({
      applicationId: 'app_test',
      secretKey: 'secret_test',
      baseUrl: 'https://api.getpinch.com.au/test/',
      apiVersion: '2020.1',
      fetch,
      now: () => 1_000,
    });

    await pinch.charge({
      payerId: 'pyr_test',
      sourceId: 'src_test',
      amountCents: 780,
      description: 'Checkout q_test',
      nonce: 'checkout-q_test',
    });
    await pinch.charge({
      payerId: 'pyr_test',
      sourceId: 'src_test',
      amountCents: 780,
      description: 'Checkout q_test',
      nonce: 'checkout-q_test',
    });

    const authRequests = requests.filter(({ url }) =>
      url.includes('/connect/token'),
    );
    expect(authRequests).toHaveLength(1);
    expect(authRequests[0].init.headers).toEqual({
      'Content-Type': 'application/x-www-form-urlencoded',
    });
    expect(String(authRequests[0].init.body)).toContain(
      'grant_type=client_credentials',
    );

    const paymentRequest = requests.find(({ url }) =>
      url.endsWith('/test/payments/realtime'),
    );
    expect(paymentRequest?.init.headers).toEqual(
      expect.objectContaining({
        Authorization: 'Bearer access_test',
        'pinch-version': '2020.1',
      }),
    );
    expect(JSON.parse(String(paymentRequest?.init.body))).toEqual({
      payerId: 'pyr_test',
      sourceId: 'src_test',
      amount: 780,
      description: 'Checkout q_test',
      nonce: ['checkout-q_test'],
    });
  });

  it('sends only the Pinch token when vaulting a payment source', async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const fetch = async (input: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(input), init: init ?? {} });
      if (String(input).includes('/connect/token')) {
        return jsonResponse({
          access_token: 'access_test',
          expires_in: 3600,
        });
      }
      return jsonResponse({ id: 'src_test' }, 201);
    };
    const pinch = new PinchClient({
      applicationId: 'app_test',
      secretKey: 'secret_test',
      baseUrl: 'https://api.getpinch.com.au/test',
      fetch,
    });

    await pinch.createSource('pyr_test', 'tkn_test', '203.0.113.10');

    const sourceRequest = requests.find(({ url }) =>
      url.endsWith('/test/payers/pyr_test/sources'),
    );
    expect(JSON.parse(String(sourceRequest?.init.body))).toEqual({
      sourceType: 'credit-card',
      token: 'tkn_test',
      ipAddress: '203.0.113.10',
    });
  });
});

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
