import { createOpenAI } from '@ai-sdk/openai';
import {
  hasToolCall,
  isStepCount,
  ToolLoopAgent,
  tool,
  type ModelMessage,
} from 'ai';
import { z } from 'zod';

import type { ShoppingRepository } from '../db/repository';
import { CheckoutService } from '../domain/checkout-service';
import { cartItemCount, cartTotalCents } from '../domain/cart';
import {
  agentResultSchema,
  errorResult,
  type AgentRequest,
  type AgentResult,
} from '../domain/types';

export const SHOPPING_AGENT_MAX_STEPS = 6;

type ToolResultSummary = {
  toolName: string;
  output: unknown;
};

export function hasTerminalSearchFailure(
  toolResults: readonly ToolResultSummary[],
) {
  return toolResults.some((toolResult) => {
    if (toolResult.toolName !== 'search_products') return false;
    const parsed = agentResultSchema.safeParse(toolResult.output);
    return parsed.success && parsed.data.status === 'error';
  });
}

export type ShoppingAgentDependencies = {
  repository: ShoppingRepository;
  checkout: CheckoutService;
  openaiApiKey: string;
};

export function shoppingModelMessage(request: AgentRequest): ModelMessage {
  return {
    role: 'user',
    content: [
      {
        type: 'text',
        text: request.checkoutConfirmation
          ? `${request.request}\nExplicitly confirmed quote: ${request.checkoutConfirmation.quoteId}`
          : request.request,
      },
      ...(request.imageBase64
        ? [
            {
              type: 'file' as const,
              mediaType: 'image/jpeg',
              data: request.imageBase64,
            },
          ]
        : []),
    ],
  };
}

export function createShoppingAgentRunner(
  dependencies: ShoppingAgentDependencies,
) {
  const openai = createOpenAI({ apiKey: dependencies.openaiApiKey });

  return async (request: AgentRequest): Promise<AgentResult> => {
    const startedAt = Date.now();
    const catalogStartedAt = Date.now();
    const catalog = await dependencies.repository.listProducts();
    const catalogMs = Date.now() - catalogStartedAt;
    const catalogText = catalog
      .map(
        (product) => `- ${product.id}: ${product.name}; ${product.description}`,
      )
      .join('\n');

    const domainTools = {
      search_products: tool({
        description:
          'Search the real product catalogue by a factual name or visual description. Use it to check uncertain matches; do not infer a price.',
        inputSchema: z.object({
          query: z.string().min(1),
        }),
        execute: async ({ query }) => {
          const matches = await dependencies.repository.searchProducts(query);
          if (matches.length === 0) {
            return { status: 'error', reason: 'product_not_found' } as const;
          }
          return {
            status: 'search_results',
            products: matches.map(({ id, name, description }) => ({
              productId: id,
              name,
              description,
            })),
          } as const;
        },
      }),
      report_ambiguity: tool({
        description:
          'Return two or more real catalogue candidates when the image or request is ambiguous. Never guess between them.',
        inputSchema: z.object({
          productIds: z.array(z.string()).min(2),
        }),
        execute: async ({ productIds }): Promise<AgentResult> => {
          const candidates = (
            await Promise.all(
              [...new Set(productIds)].map((id) =>
                dependencies.repository.getProduct(id),
              ),
            )
          )
            .filter((product) => product !== null)
            .map((product) => ({
              productId: product.id,
              name: product.name,
            }));

          if (candidates.length < 2) {
            return { status: 'error', reason: 'invalid_candidates' };
          }
          return { status: 'ambiguous', candidates };
        },
      }),
      add_to_cart: tool({
        description:
          'Add a known catalogue product. The tool reads the authoritative product name and price from the database.',
        inputSchema: z.object({
          productId: z.string(),
          qty: z.number().int().min(1),
        }),
        execute: async ({ productId, qty }): Promise<AgentResult> => {
          try {
            const { product, cart } = await dependencies.repository.addToCart(
              request.userId,
              productId,
              qty,
            );
            return {
              status: 'completed',
              action: 'added',
              facts: {
                productId: product.id,
                product: product.name,
                priceCents: product.priceCents,
                qty,
                cartCount: cartItemCount(cart),
              },
            };
          } catch (error) {
            return errorResult(error);
          }
        },
      }),
      remove_from_cart: tool({
        description:
          'Remove a known product completely from the cart. Use this for negative intent such as “I do not want the milk anymore”, “take the water out”, “remove this”, or “I changed my mind about the chips”.',
        inputSchema: z.object({
          productId: z.string(),
        }),
        execute: async ({ productId }): Promise<AgentResult> => {
          try {
            const { removed, cart } =
              await dependencies.repository.removeFromCart(
                request.userId,
                productId,
              );
            return {
              status: 'completed',
              action: 'removed',
              facts: {
                productId: removed.productId,
                product: removed.name,
                removedQty: removed.qty,
                cartCount: cartItemCount(cart),
              },
            };
          } catch (error) {
            return errorResult(error);
          }
        },
      }),
      get_cart: tool({
        description:
          'Read the current cart. Names, quantities and prices come from stored cart facts.',
        inputSchema: z.object({}),
        execute: async (): Promise<AgentResult> => {
          const cart = await dependencies.repository.getCart(request.userId);
          return {
            status: 'completed',
            action: 'cart',
            facts: {
              items: cart,
              totalCents: cartTotalCents(cart),
            },
          };
        },
      }),
      prepare_checkout: tool({
        description:
          'Prepare an exact checkout quote without charging. Always use this before asking for payment confirmation.',
        inputSchema: z.object({}),
        execute: async (): Promise<AgentResult> =>
          dependencies.checkout.prepare(request.userId),
      }),
    };

    const tools = request.checkoutConfirmation
      ? {
          ...domainTools,
          confirm_checkout: tool({
            description:
              'Charge only the exact quote explicitly confirmed by the user.',
            inputSchema: z.object({
              quoteId: z.literal(request.checkoutConfirmation.quoteId),
            }),
            execute: async ({ quoteId }): Promise<AgentResult> =>
              dependencies.checkout.confirm(request.userId, quoteId),
          }),
        }
      : domainTools;

    const agent = new ToolLoopAgent({
      model: openai.responses('gpt-5.6-sol'),
      instructions: shoppingAgentPrompt(catalogText),
      providerOptions: {
        openai: {
          reasoningEffort: 'medium',
          parallelToolCalls: false,
        },
      },
      stopWhen: [
        hasToolCall(
          'report_ambiguity',
          'add_to_cart',
          'remove_from_cart',
          'prepare_checkout',
          'confirm_checkout',
        ),
        ({ steps }) =>
          hasTerminalSearchFailure(steps[steps.length - 1]?.toolResults ?? []),
        isStepCount(SHOPPING_AGENT_MAX_STEPS),
      ],
      toolChoice: 'auto',
      tools,
    });

    const agentStartedAt = Date.now();
    const result = await agent.generate({
      messages: [shoppingModelMessage(request)],
    });
    const agentMs = Date.now() - agentStartedAt;
    const toolResults = result.steps.flatMap((step) => step.toolResults);
    const lastOutput = toolResults.at(-1)?.output;
    const parsed = agentResultSchema.safeParse(lastOutput);
    const output: AgentResult = parsed.success
      ? parsed.data
      : { status: 'error', reason: 'no_domain_result' };

    console.info(
      JSON.stringify({
        level: 'info',
        event: 'shopping_agent_completed',
        traceId: request.traceId,
        totalMs: Date.now() - startedAt,
        catalogMs,
        agentMs,
        hasImage: Boolean(request.imageBase64),
        stepCount: result.steps.length,
        reachedStepLimit: result.steps.length >= SHOPPING_AGENT_MAX_STEPS,
        steps: result.steps.map((step) => ({
          step: step.stepNumber + 1,
          finishReason: step.finishReason,
          tools: step.toolCalls.map((call) => call.toolName),
          responseMs: step.performance.responseTimeMs,
          toolMs: Object.values(step.performance.toolExecutionMs).reduce(
            (total, duration) => total + duration,
            0,
          ),
        })),
        outcome:
          output.status === 'completed'
            ? output.action
            : output.status === 'error'
              ? output.reason
              : output.status,
      }),
    );

    return output;
  };
}

export function shoppingAgentPrompt(catalog: string) {
  return `You are the visual and transactional shopping agent. You see an optional image and receive a self-contained factual shopping request.

Catalogue:
${catalog}

Rules:
- Use tools for every domain outcome. Never answer with prose alone.
- Product IDs must come from this catalogue, and authoritative names and prices must come from database tools.
- Never infer a price from an image or label.
- When the request says "this" or "that" with an image, identify the single product the customer is deliberately holding closest to the camera. Prefer the dominant hand-held foreground package and its visible brand and product wording.
- Treat shelves, desk clutter, and every other product behind or beside the held foreground package as background. Never select a background product merely because its label is easier to read.
- If no single held or dominant foreground product can be identified, do not guess a background item. Report ambiguity only when two or more catalogue products are genuinely plausible for the intended foreground target.
- For adding a clearly identified product, call add_to_cart.
- Negative intent such as "I don't want X anymore", "take X out", "remove X", or "not X" is always a removal, never an add.
- For a removal, map the named item to the catalogue and call remove_from_cart. If the cart reference is unclear, call get_cart first, then remove only the item the customer identified.
- For cart reads and checkout, use their corresponding tools.
- If two or more catalogue products are plausible, do not guess: call report_ambiguity with only those candidate IDs.
- If no catalogue item matches, call search_products exactly once with the best factual description. Its no-match error is the final result and must not be retried.
- A checkout request without explicit quote confirmation must only call prepare_checkout.
- When an explicit confirmed quote is present, call confirm_checkout immediately and do not call another tool first.
- confirm_checkout is available only when the request carries explicit server-validated confirmation. Never substitute another quote ID.
- Never repeat a successful side-effecting tool call. After add, remove, prepare or confirm returns its domain result, conclude without another tool.
- Do not perform unrelated actions or call tools speculatively.`;
}
