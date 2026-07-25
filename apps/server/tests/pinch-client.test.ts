import { describe, expect, it, vi } from "vitest";

import { createPinchClient } from "../src/adapters/pinch-client.js";

describe("Pinch client", () => {
  it("caches one OAuth client-credentials token across authenticated requests", async () => {
    let payerCount = 0;
    const request = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/connect/token")) {
        expect(init?.body).toBeInstanceOf(URLSearchParams);
        expect(String(init?.body)).toContain("grant_type=client_credentials");
        return Response.json({ access_token: "oauth_token", expires_in: 3600 });
      }
      expect(new Headers(init?.headers).get("authorization")).toBe(
        "Bearer oauth_token",
      );
      payerCount += 1;
      return Response.json({ id: `payer_${payerCount}` }, { status: 201 });
    });
    const client = createPinchClient({
      applicationId: "application_id",
      secretKey: "secret_key",
      apiBaseUrl: "https://api.example.test/test",
      apiVersion: "2020.1",
      fetch: request,
      now: () => 1_000,
    });

    await client.createPayer({
      firstName: "alice",
      emailAddress: "alice@example.com",
    });
    await client.createPayer({
      firstName: "bob",
      emailAddress: "bob@example.com",
    });

    expect(request).toHaveBeenCalledTimes(3);
    expect(
      request.mock.calls.filter(([url]) =>
        String(url).endsWith("/connect/token"),
      ),
    ).toHaveLength(1);
  });

  it("attaches sources and sends a stable nonce for realtime charges", async () => {
    const request = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/connect/token")) {
        return Response.json({ access_token: "oauth_token", expires_in: 3600 });
      }
      if (url.endsWith("/payers/payer_1/sources")) {
        expect(JSON.parse(String(init?.body))).toEqual({
          sourceType: "credit-card",
          token: "temporary_token",
        });
        return Response.json({ id: "source_1" }, { status: 201 });
      }
      expect(url).toMatch(/\/payments\/realtime$/);
      expect(JSON.parse(String(init?.body))).toMatchObject({
        nonce: "checkout-quote_1",
      });
      return Response.json(
        { id: "payment_1", status: "approved" },
        { status: 201 },
      );
    });
    const client = createPinchClient({
      applicationId: "application_id",
      secretKey: "secret_key",
      apiBaseUrl: "https://api.example.test/test",
      apiVersion: "2020.1",
      fetch: request,
    });

    await expect(
      client.attachSource({ payerId: "payer_1", token: "temporary_token" }),
    ).resolves.toEqual({ id: "source_1" });
    await expect(
      client.charge({
        payerId: "payer_1",
        sourceId: "source_1",
        amount: 499,
        description: "Order",
        nonce: "checkout-quote_1",
      }),
    ).resolves.toEqual({ id: "payment_1", status: "approved" });
  });

  it("queries by nonce after an unknown realtime payment outcome", async () => {
    const request = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith("/connect/token")) {
        return Response.json({ access_token: "oauth_token", expires_in: 3600 });
      }
      if (url.endsWith("/payments/realtime"))
        throw new TypeError("connection lost");
      if (url.endsWith("/payments/nonce")) {
        return Response.json({ id: "payment_recovered", status: "approved" });
      }
      throw new Error("unexpected request");
    });
    const client = createPinchClient({
      applicationId: "application_id",
      secretKey: "secret_key",
      apiBaseUrl: "https://api.example.test/test",
      apiVersion: "2020.1",
      fetch: request,
    });

    await expect(
      client.charge({
        payerId: "payer_1",
        sourceId: "source_1",
        amount: 499,
        description: "Order",
        nonce: "checkout-quote_1",
      }),
    ).resolves.toEqual({ id: "payment_recovered", status: "approved" });
  });

  it("returns a documented dishonoured payment instead of treating it as malformed", async () => {
    const request = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith("/connect/token")) {
        return Response.json({ access_token: "oauth_token", expires_in: 3600 });
      }
      return Response.json(
        { id: "payment_declined", status: "dishonoured" },
        { status: 201 },
      );
    });
    const client = createPinchClient({
      applicationId: "application_id",
      secretKey: "secret_key",
      apiBaseUrl: "https://api.example.test/test",
      apiVersion: "2020.1",
      fetch: request,
    });

    await expect(
      client.charge({
        payerId: "payer_1",
        sourceId: "source_1",
        amount: 499,
        description: "Order",
        nonce: "checkout-quote_1",
      }),
    ).resolves.toEqual({
      id: "payment_declined",
      status: "dishonoured",
    });
  });

  it("accepts a future non-empty status returned by nonce recovery", async () => {
    const request = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith("/connect/token")) {
        return Response.json({ access_token: "oauth_token", expires_in: 3600 });
      }
      if (url.endsWith("/payments/realtime")) {
        throw new TypeError("connection lost");
      }
      return Response.json({
        id: "payment_recovered",
        status: "future-valid-status",
      });
    });
    const client = createPinchClient({
      applicationId: "application_id",
      secretKey: "secret_key",
      apiBaseUrl: "https://api.example.test/test",
      apiVersion: "2020.1",
      fetch: request,
    });

    await expect(
      client.charge({
        payerId: "payer_1",
        sourceId: "source_1",
        amount: 499,
        description: "Order",
        nonce: "checkout-quote_1",
      }),
    ).resolves.toEqual({
      id: "payment_recovered",
      status: "future-valid-status",
    });
  });
});
