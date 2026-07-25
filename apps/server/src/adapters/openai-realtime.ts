import { z } from "zod";
import { createHash } from "node:crypto";

const secretSchema = z.object({
  value: z.string().min(1),
  expires_at: z.number().int().positive(),
});

export type RealtimeClientSecret = {
  value: string;
  expiresAt: number;
};

export interface RealtimeClient {
  issueClientSecret(safetyIdentifier?: string): Promise<RealtimeClientSecret>;
}

type Options = {
  apiKey: string;
  model: string;
  fetch?: typeof fetch;
};

const shoppingTool = {
  type: "function",
  name: "shopping_agent",
  description:
    "Handle shopping requests. Set needs_photo for a physical item. Prepare a quote before confirming payment.",
  parameters: {
    type: "object",
    properties: {
      request: {
        type: "string",
        description:
          "A self-contained factual request without invented product IDs or prices.",
      },
      needs_photo: { type: "boolean" },
      checkout_confirmation: {
        type: "object",
        properties: {
          quote_id: { type: "string" },
          confirmed: { type: "boolean", const: true },
        },
        required: ["quote_id", "confirmed"],
        additionalProperties: false,
      },
    },
    required: ["request", "needs_photo"],
    additionalProperties: false,
  },
} as const;

export const createOpenAiRealtimeClient = ({
  apiKey,
  model,
  fetch: request = globalThis.fetch,
}: Options): RealtimeClient => ({
  async issueClientSecret(safetyIdentifier) {
    const safetyHash = safetyIdentifier
      ? createHash("sha256").update(safetyIdentifier).digest("hex").slice(0, 59)
      : undefined;
    const response = await request(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
          ...(safetyHash
            ? { "OpenAI-Safety-Identifier": `user_${safetyHash}` }
            : {}),
        },
        body: JSON.stringify({
          expires_after: { anchor: "created_at", seconds: 600 },
          session: {
            type: "realtime",
            model,
            instructions: [
              "You are the voice layer for an in-store shopping assistant. Mirror the user language.",
              "Before a tool may take more than one second, say a short neutral preamble.",
              "Never imply success, price, cart state, or payment until the tool result confirms it.",
              "Send self-contained factual requests and never invent product IDs or prices.",
              "Checkout is two-stage: prepare a quote, ask for explicit confirmation, then confirm it.",
              "If a product or request is ambiguous, ask a concise clarifying question.",
            ].join(" "),
            audio: { output: { voice: "marin" } },
            tools: [shoppingTool],
            tool_choice: "auto",
            parallel_tool_calls: false,
            reasoning: { effort: "low" },
          },
        }),
      },
    );
    if (!response.ok)
      throw new Error(`OpenAI Realtime request failed (${response.status})`);
    const result = secretSchema.safeParse(await response.json());
    if (!result.success)
      throw new Error("OpenAI Realtime response was invalid");
    return { value: result.data.value, expiresAt: result.data.expires_at };
  },
});
