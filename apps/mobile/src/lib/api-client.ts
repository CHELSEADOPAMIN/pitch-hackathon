import type { AppType } from "@pinch-voice/server/app";
import { hc } from "hono/client";

import type { PinchCardDetails } from "@/lib/card-details";
import { assertTestPaymentConfig, clientConfig } from "@/lib/client-config";
import type {
  AgentRequest,
  AgentResult,
  DemoUser,
  Order,
} from "@/types/domain";

const backend = hc<AppType>(clientConfig.apiBaseUrl);

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function requireOk(response: { ok: boolean }, message: string) {
  if (!response.ok) throw new ApiError(message);
}

export async function login(
  username: string,
): Promise<{ user: DemoUser; hasPaymentMethod: boolean }> {
  try {
    const response = await backend.api.login.$post({
      json: { username: username.trim() },
    });
    requireOk(response, "The demo server could not start this session.");
    const result = await response.json();
    if (!("userId" in result))
      throw new ApiError("The login request was invalid.");
    return {
      user: { id: result.userId, username: result.username },
      hasPaymentMethod: result.hasPaymentMethod,
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      "Cannot reach the demo server. Check the network and try again.",
    );
  }
}

export async function tokenizeCard(card: PinchCardDetails): Promise<string> {
  assertTestPaymentConfig();
  let response: Response;
  try {
    response = await fetch(`${clientConfig.pinchApiBaseUrl}/tokens`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "pinch-version": clientConfig.pinchApiVersion,
      },
      body: JSON.stringify({
        publishableKey: clientConfig.pinchPublishableKey,
        ...card,
      }),
    });
  } catch {
    throw new ApiError(
      "Pinch could not be reached. Check the connection and try again.",
    );
  }

  const body = await readJson(response);
  if (!response.ok)
    throw new ApiError("Pinch could not verify those test-card details.");
  if (
    typeof body !== "object" ||
    body === null ||
    !("token" in body) ||
    typeof body.token !== "string"
  ) {
    throw new ApiError("Pinch returned an invalid token response.");
  }
  return body.token;
}

export async function attachPaymentSource(userId: string, token: string) {
  try {
    const response = await backend.api["payment-source"].$post({
      json: { userId, token },
    });
    requireOk(response, "The tokenized card could not be attached. Try again.");
    const result = await response.json();
    if (!("hasPaymentMethod" in result))
      throw new ApiError("The card token was invalid.");
    if (!result.hasPaymentMethod)
      throw new ApiError("The payment source was not attached.");
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      "Cannot reach the demo server. Check the network and try again.",
    );
  }
}

export async function getRealtimeClientSecret(userId: string) {
  try {
    const response = await backend.api["realtime-token"].$post({
      json: { userId },
    });
    requireOk(response, "The demo server could not start a voice session.");
    const result = await response.json();
    if (!("value" in result))
      throw new ApiError("The voice-session request was invalid.");
    return result.value;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      "Cannot reach the demo server. Check the network and try again.",
    );
  }
}

export async function runShoppingAgent(
  request: AgentRequest,
): Promise<AgentResult> {
  try {
    const response = await backend.api.agent.$post({ json: request });
    requireOk(response, "The shopping agent could not complete that request.");
    const result = await response.json();
    if (!("status" in result))
      throw new ApiError("The shopping request was invalid.");
    return result;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("The shopping agent is unavailable. Try again.");
  }
}

export async function getOrders(): Promise<Order[]> {
  try {
    const response = await backend.api.orders.$get();
    requireOk(response, "The order feed is unavailable.");
    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      "Cannot refresh orders. Check the network and try again.",
    );
  }
}
