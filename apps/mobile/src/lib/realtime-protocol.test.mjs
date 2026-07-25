import assert from "node:assert/strict";
import test from "node:test";

import {
  createToolOutputEvents,
  parseRealtimeEvent,
} from "./realtime-protocol.ts";
import { SESSION_UPDATE } from "./realtime-session-config.ts";

test("maps a completed shopping_agent call into the backend request shape", () => {
  const parsed = parseRealtimeEvent(
    JSON.stringify({
      type: "response.done",
      response: {
        output: [
          {
            type: "function_call",
            name: "shopping_agent",
            call_id: "call_123",
            arguments: JSON.stringify({
              request: "The customer explicitly confirmed the prepared quote.",
              needs_photo: false,
              checkout_confirmation: { quote_id: "quote_123", confirmed: true },
            }),
          },
        ],
      },
    }),
  );

  assert.deepEqual(parsed, {
    kind: "shopping-agent",
    callId: "call_123",
    request: {
      request: "The customer explicitly confirmed the prepared quote.",
      needsPhoto: false,
      checkoutConfirmation: { quoteId: "quote_123", confirmed: true },
    },
  });
});

test("serializes domain facts as a function output followed by response.create", () => {
  const events = createToolOutputEvents("call_123", {
    status: "completed",
    action: "added",
    facts: { product: "Milk", priceCents: 490 },
  });

  assert.deepEqual(events, [
    {
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: "call_123",
        output: JSON.stringify({
          status: "completed",
          action: "added",
          facts: { product: "Milk", priceCents: 490 },
        }),
      },
    },
    { type: "response.create" },
  ]);
});

test("configures one serialized shopping tool with low voice reasoning", () => {
  assert.equal(SESSION_UPDATE.type, "session.update");
  assert.equal(SESSION_UPDATE.session.type, "realtime");
  assert.equal(SESSION_UPDATE.session.tools.length, 1);
  assert.equal(SESSION_UPDATE.session.tools[0].name, "shopping_agent");
  assert.equal(SESSION_UPDATE.session.parallel_tool_calls, false);
  assert.equal(SESSION_UPDATE.session.reasoning.effort, "low");
});
