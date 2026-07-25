import { z } from 'zod';

const oauthResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.number().positive(),
});

const payerResponseSchema = z.object({
  id: z.string(),
});

const sourceResponseSchema = z.object({
  id: z.string(),
});

const paymentResponseSchema = z
  .object({
    id: z.string(),
    status: z.string(),
  })
  .passthrough();

export type PinchChargeInput = {
  payerId: string;
  sourceId: string;
  amountCents: number;
  description: string;
  nonce: string;
};

export type PinchChargeResult = {
  id: string;
  status: string;
};

export interface PinchPaymentGateway {
  charge(input: PinchChargeInput): Promise<PinchChargeResult>;
}

export interface PinchGateway extends PinchPaymentGateway {
  createPayer(username: string): Promise<{ id: string }>;
  createSource(
    payerId: string,
    token: string,
    ipAddress: string,
  ): Promise<{ id: string }>;
}

export type PinchClientOptions = {
  applicationId: string;
  secretKey: string;
  baseUrl: string;
  apiVersion?: string;
  authUrl?: string;
  fetch?: typeof globalThis.fetch;
  now?: () => number;
};

export class PinchClient implements PinchGateway {
  private accessToken?: { value: string; expiresAt: number };
  private tokenRequest?: Promise<string>;
  private readonly fetch: typeof globalThis.fetch;
  private readonly now: () => number;

  constructor(private readonly options: PinchClientOptions) {
    this.fetch = options.fetch ?? globalThis.fetch;
    this.now = options.now ?? Date.now;
  }

  async createPayer(username: string) {
    const response = await this.request('payers', {
      method: 'POST',
      body: JSON.stringify({
        firstName: username,
        emailAddress: `${username}@demo.local`,
      }),
    });
    return payerResponseSchema.parse(response);
  }

  async createSource(payerId: string, token: string, ipAddress: string) {
    const response = await this.request(
      `payers/${encodeURIComponent(payerId)}/sources`,
      {
        method: 'POST',
        body: JSON.stringify({
          sourceType: 'credit-card',
          token,
          ipAddress,
        }),
      },
    );
    return sourceResponseSchema.parse(response);
  }

  async charge(input: PinchChargeInput): Promise<PinchChargeResult> {
    if (!Number.isInteger(input.amountCents) || input.amountCents < 0) {
      throw new Error('Pinch amount must be a non-negative integer in cents');
    }

    const response = await this.request('payments/realtime', {
      method: 'POST',
      body: JSON.stringify({
        payerId: input.payerId,
        sourceId: input.sourceId,
        amount: input.amountCents,
        description: input.description,
        nonce: [input.nonce],
      }),
    });
    return paymentResponseSchema.parse(response);
  }

  private async request(path: string, init: RequestInit) {
    const response = await this.fetch(
      `${this.options.baseUrl.replace(/\/+$/, '')}/${path}`,
      {
        ...init,
        headers: {
          Authorization: `Bearer ${await this.getAccessToken()}`,
          'Content-Type': 'application/json',
          'pinch-version': this.options.apiVersion ?? '2020.1',
          ...init.headers,
        },
      },
    );

    const payload = await parseResponse(response);
    if (!response.ok) {
      throw new Error(`Pinch API ${response.status}: ${stringify(payload)}`);
    }
    return payload;
  }

  private async getAccessToken(): Promise<string> {
    const cached = this.accessToken;
    if (cached && cached.expiresAt > this.now()) return cached.value;
    if (this.tokenRequest) return this.tokenRequest;

    this.tokenRequest = this.fetchAccessToken();
    try {
      return await this.tokenRequest;
    } finally {
      this.tokenRequest = undefined;
    }
  }

  private async fetchAccessToken(): Promise<string> {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.options.applicationId,
      client_secret: this.options.secretKey,
      scope: 'api1',
    });
    const response = await this.fetch(
      this.options.authUrl ?? 'https://auth.getpinch.com.au/connect/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      },
    );
    const payload = await parseResponse(response);
    if (!response.ok) {
      throw new Error(`Pinch auth ${response.status}: ${stringify(payload)}`);
    }

    const token = oauthResponseSchema.parse(payload);
    this.accessToken = {
      value: token.access_token,
      expiresAt: this.now() + Math.max(0, token.expires_in - 60) * 1000,
    };
    return token.access_token;
  }
}

async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function stringify(value: unknown) {
  return typeof value === 'string' ? value : JSON.stringify(value);
}
