export type CheckoutConfirmation = {
  quoteId: string;
  confirmed: true;
};

export type ShoppingAgentRequest = {
  request: string;
  needsPhoto: boolean;
  checkoutConfirmation?: CheckoutConfirmation;
};

export type ParsedRealtimeEvent =
  | { kind: "ignored" }
  | { kind: "invalid"; reason: string }
  | { kind: "shopping-agent"; callId: string; request: ShoppingAgentRequest };

type JsonRecord = Record<string, unknown>;

export function createToolOutputEvents(callId: string, result: unknown) {
  return [
    {
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output: JSON.stringify(result),
      },
    },
    { type: "response.create" },
  ];
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(reason: string): ParsedRealtimeEvent {
  return { kind: "invalid", reason };
}

export function parseRealtimeEvent(raw: string): ParsedRealtimeEvent {
  let event: unknown;

  try {
    event = JSON.parse(raw);
  } catch {
    return invalid("OpenAI sent an unreadable event.");
  }

  if (!isRecord(event) || event.type !== "response.done")
    return { kind: "ignored" };
  if (!isRecord(event.response) || !Array.isArray(event.response.output)) {
    return invalid("The completed response did not contain output.");
  }

  const call = event.response.output.find(
    (item): item is JsonRecord =>
      isRecord(item) &&
      item.type === "function_call" &&
      item.name === "shopping_agent",
  );
  if (!call) return { kind: "ignored" };
  if (typeof call.call_id !== "string" || typeof call.arguments !== "string") {
    return invalid("The shopping request was incomplete.");
  }

  let args: unknown;
  try {
    args = JSON.parse(call.arguments);
  } catch {
    return invalid("The shopping request arguments were unreadable.");
  }

  if (
    !isRecord(args) ||
    typeof args.request !== "string" ||
    !args.request.trim()
  ) {
    return invalid("The shopping request did not include a request.");
  }
  if (typeof args.needs_photo !== "boolean") {
    return invalid(
      "The shopping request did not specify whether a photo is needed.",
    );
  }

  const request: ShoppingAgentRequest = {
    request: args.request.trim(),
    needsPhoto: args.needs_photo,
  };

  if (args.checkout_confirmation !== undefined) {
    const confirmation = args.checkout_confirmation;
    if (
      !isRecord(confirmation) ||
      typeof confirmation.quote_id !== "string" ||
      !confirmation.quote_id ||
      confirmation.confirmed !== true
    ) {
      return invalid("The checkout confirmation was invalid.");
    }
    request.checkoutConfirmation = {
      quoteId: confirmation.quote_id,
      confirmed: true,
    };
  }

  return { kind: "shopping-agent", callId: call.call_id, request };
}
