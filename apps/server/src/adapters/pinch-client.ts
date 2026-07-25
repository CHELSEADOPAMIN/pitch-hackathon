import { z } from "zod";

import type { PaymentGateway } from "../domain/gateways.js";
import type { Payment } from "../domain/types.js";

const oauthSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive(),
});
const idSchema = z.object({ id: z.string().min(1) });
const paymentSchema = z.object({
  id: z.string().min(1),
  status: z.string().trim().min(1).max(128),
});

export class PinchRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "PinchRequestError";
  }
}

export interface PinchClient extends PaymentGateway {
  health(): Promise<boolean>;
  createPayer(input: {
    firstName: string;
    emailAddress: string;
    mobileNumber?: string;
  }): Promise<{ id: string }>;
  attachSource(input: {
    payerId: string;
    token: string;
  }): Promise<{ id: string }>;
}

type Options = {
  applicationId: string;
  secretKey: string;
  apiBaseUrl: string;
  apiVersion: string;
  authUrl?: string;
  nonceFormat?: "string" | "array";
  fetch?: typeof fetch;
  now?: () => number;
};

export const createPinchClient = ({
  applicationId,
  secretKey,
  apiBaseUrl,
  apiVersion,
  authUrl = "https://auth.getpinch.com.au/connect/token",
  nonceFormat = "string",
  fetch: request = globalThis.fetch,
  now = Date.now,
}: Options): PinchClient => {
  let cachedToken: { value: string; expiresAt: number } | undefined;
  let tokenRequest: Promise<string> | undefined;

  const obtainToken = async () => {
    if (cachedToken && now() < cachedToken.expiresAt - 30_000)
      return cachedToken.value;
    if (tokenRequest) return tokenRequest;

    tokenRequest = (async () => {
      const body = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: applicationId,
        client_secret: secretKey,
        scope: "api1",
      });
      const response = await request(authUrl, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
      });
      if (!response.ok)
        throw new PinchRequestError(
          "Pinch authentication failed",
          response.status,
        );
      const token = oauthSchema.safeParse(await response.json());
      if (!token.success)
        throw new PinchRequestError(
          "Pinch authentication response was invalid",
        );
      cachedToken = {
        value: token.data.access_token,
        expiresAt: now() + token.data.expires_in * 1_000,
      };
      return cachedToken.value;
    })().finally(() => {
      tokenRequest = undefined;
    });
    return tokenRequest;
  };

  const requestJson = async (path: string, init: RequestInit = {}) => {
    const token = await obtainToken();
    let response: Response;
    try {
      response = await request(`${apiBaseUrl.replace(/\/$/, "")}${path}`, {
        ...init,
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          "pinch-version": apiVersion,
          ...init.headers,
        },
      });
    } catch (error) {
      throw new PinchRequestError(
        error instanceof Error
          ? `Pinch request failed: ${error.name}`
          : "Pinch request failed",
      );
    }
    if (!response.ok)
      throw new PinchRequestError(
        "Pinch request was rejected",
        response.status,
      );
    if (response.status === 204) return undefined;
    return response.json() as Promise<unknown>;
  };

  const parseId = (value: unknown, label: string) => {
    const result = idSchema.safeParse(value);
    if (!result.success)
      throw new PinchRequestError(`Pinch ${label} response was invalid`);
    return result.data;
  };

  const lookupPayment = async (nonce: string): Promise<Payment | undefined> => {
    const value = await requestJson("/payments/nonce", {
      method: "POST",
      body: JSON.stringify({ nonce }),
    });
    const direct = paymentSchema.safeParse(value);
    if (direct.success) return direct.data;
    const list = z.array(paymentSchema).safeParse(value);
    if (list.success) return list.data[0];
    const wrapped = z.object({ data: z.array(paymentSchema) }).safeParse(value);
    return wrapped.success ? wrapped.data.data[0] : undefined;
  };

  return {
    async health() {
      await requestJson("/health/auth");
      return true;
    },
    async createPayer(input) {
      return parseId(
        await requestJson("/payers", {
          method: "POST",
          body: JSON.stringify(input),
        }),
        "payer",
      );
    },
    async attachSource({ payerId, token }) {
      return parseId(
        await requestJson(`/payers/${encodeURIComponent(payerId)}/sources`, {
          method: "POST",
          body: JSON.stringify({ sourceType: "credit-card", token }),
        }),
        "source",
      );
    },
    async charge(input) {
      try {
        const value = await requestJson("/payments/realtime", {
          method: "POST",
          body: JSON.stringify({
            payerId: input.payerId,
            sourceId: input.sourceId,
            amount: input.amount,
            description: input.description,
            nonce: nonceFormat === "array" ? [input.nonce] : input.nonce,
          }),
        });
        const result = paymentSchema.safeParse(value);
        if (!result.success)
          throw new PinchRequestError("Pinch payment response was invalid");
        return result.data;
      } catch (error) {
        if (
          error instanceof PinchRequestError &&
          error.status &&
          error.status < 500
        )
          throw error;
        const recovered = await lookupPayment(input.nonce).catch(
          () => undefined,
        );
        if (recovered) return recovered;
        throw error;
      }
    },
  };
};
