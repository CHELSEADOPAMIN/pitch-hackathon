import type { OpenAILanguageModelResponsesOptions } from "@ai-sdk/openai";
import {
  isStepCount,
  ToolLoopAgent,
  tool,
  type LanguageModel,
  type UserContent,
} from "ai";
import { z } from "zod";

import type { ShoppingDomain } from "../domain/shopping-domain.js";
import type { AgentResult } from "../domain/types.js";

export type ShoppingAgentInput = {
  userId: string;
  request: string;
  imageBase64?: string;
  checkoutConfirmation?: { quoteId: string; confirmed: true };
};

export interface ShoppingAgent {
  run(input: ShoppingAgentInput): Promise<AgentResult>;
}

type Options = {
  domain: ShoppingDomain;
  model: LanguageModel;
};

const isAgentResult = (value: unknown): value is AgentResult => {
  if (!value || typeof value !== "object" || !("status" in value)) return false;
  return [
    "completed",
    "ambiguous",
    "not_found",
    "needs_confirmation",
    "paid",
    "error",
  ].includes(String(value.status));
};

export const createTerraShoppingAgent = ({
  domain,
  model,
}: Options): ShoppingAgent => ({
  async run(input) {
    const catalog = await domain.getCatalog();
    const confirmation = input.checkoutConfirmation;
    const tools = {
      search_products: tool({
        description:
          "Search the authoritative product catalog by name or description.",
        inputSchema: z.object({ query: z.string().min(1) }),
        execute: ({ query }) => domain.searchProducts(query),
      }),
      add_to_cart: tool({
        description: "Add an authoritative catalog product to the user cart.",
        inputSchema: z.object({
          productId: z.string().min(1),
          qty: z.number().int().min(1),
        }),
        execute: ({ productId, qty }) =>
          domain.addToCart(input.userId, productId, qty),
      }),
      remove_from_cart: tool({
        description: "Remove a catalog product from the user cart.",
        inputSchema: z.object({ productId: z.string().min(1) }),
        execute: ({ productId }) =>
          domain.removeFromCart(input.userId, productId),
      }),
      get_cart: tool({
        description: "Read the current authoritative cart.",
        inputSchema: z.object({}),
        execute: () => domain.getCart(input.userId),
      }),
      prepare_checkout: tool({
        description: "Create a five-minute quote without charging.",
        inputSchema: z.object({}),
        execute: () => domain.prepareCheckout(input.userId),
      }),
      ...(confirmation
        ? {
            confirm_checkout: tool({
              description:
                "Charge only the quote explicitly confirmed by the user.",
              inputSchema: z.object({
                quoteId: z.literal(confirmation.quoteId),
              }),
              execute: ({ quoteId }) =>
                domain.confirmCheckout(input.userId, quoteId),
            }),
          }
        : {}),
    };

    const agent = new ToolLoopAgent({
      model,
      instructions: [
        "You operate deterministic shopping tools. Always call a tool; never invent facts.",
        "Use catalog IDs and prices only. Clarify ambiguity by returning the relevant tool result.",
        "Checkout is two-stage: prepare first; confirm only when that tool is available.",
        `Authoritative catalog: ${JSON.stringify(catalog)}`,
      ].join("\n"),
      tools,
      stopWhen: isStepCount(20),
      providerOptions: {
        openai: {
          reasoningEffort: "high",
          parallelToolCalls: false,
          store: false,
        } satisfies OpenAILanguageModelResponsesOptions,
      },
    });
    const content: UserContent = [
      {
        type: "text",
        text: confirmation
          ? `${input.request}\nExplicitly confirmed quote: ${confirmation.quoteId}`
          : input.request,
      },
      ...(input.imageBase64
        ? [
            {
              type: "file" as const,
              data: input.imageBase64,
              mediaType: "image/jpeg",
            },
          ]
        : []),
    ];
    const result = await agent.generate({
      messages: [{ role: "user", content }],
    });
    const lastOutput = result.steps
      .flatMap((step) => step.toolResults)
      .at(-1)?.output;
    return isAgentResult(lastOutput)
      ? lastOutput
      : { status: "error", reason: "no_domain_result" };
  },
});
