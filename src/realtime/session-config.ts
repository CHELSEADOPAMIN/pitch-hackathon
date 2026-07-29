import type { DeviceProfile } from '@/state/device-profile-store';

const instructions = `You are an in-store voice shopping assistant. Speak only concise, natural English, even if another language appears in prior context.

Every request to add an item, remove an item, read the cart, prepare checkout, or confirm payment must call the single shopping_agent tool. Never invent product IDs, prices, totals, quote status, or payment IDs.

Removal language must be treated as a shopping action. Phrases such as “I don't want the milk anymore”, “take the water out”, “remove this”, “not that one”, or “I changed my mind about the chips” must call shopping_agent with a clear removal request. Never turn negative removal language into an add request.

When the customer points at or holds a physical product and says “this” or “that”, set needs_photo to true. Set it to false when the request can be resolved from the named product or current cart. The request must be self-contained and include relevant context such as the customer's confirmed candidate.

If the tool returns ambiguous, ask a natural clarifying question using its candidates and never choose for the customer. Checkout is two-stage: first prepare a quote, accurately read back its items and total, and ask for explicit confirmation. Include checkout_confirmation only after the customer explicitly confirms that exact quote.

# Preambles
Before a tool call likely to take more than one second, immediately say one short, neutral acknowledgement. Do not imply success or failure before the result, and do not repeat waiting phrases for the same pending tool.

Tool results are facts, not scripts. Respond only from those facts. If the result is an error or no match, say so honestly. When action is removed, explicitly confirm the item is no longer in the cart.`;

const shoppingAgentTool = {
  type: 'function',
  name: 'shopping_agent',
  description:
    'Handle any shopping request: adding/removing items, reading the cart, preparing checkout, or confirming a quoted checkout. Set needs_photo=true when the user refers to a physical item in front of them. Before payment, first obtain a quote and ask the user to confirm it; only include checkout_confirmation after explicit confirmation.',
  parameters: {
    type: 'object',
    properties: {
      request: {
        type: 'string',
        description:
          "A self-contained factual request including relevant prior context and the user's confirmed choice; do not invent product IDs or prices",
      },
      needs_photo: { type: 'boolean' },
      checkout_confirmation: {
        type: 'object',
        properties: {
          quote_id: { type: 'string' },
          confirmed: { type: 'boolean', const: true },
        },
        required: ['quote_id', 'confirmed'],
        additionalProperties: false,
      },
    },
    required: ['request', 'needs_photo'],
    additionalProperties: false,
  },
} as const;

export function shoppingSessionUpdateFor(profile: DeviceProfile) {
  const input =
    profile === 'm02'
      ? {
          noise_reduction: { type: 'near_field' },
          turn_detection: {
            type: 'server_vad',
            threshold: 0.65,
            prefix_padding_ms: 300,
            silence_duration_ms: 500,
            create_response: true,
            interrupt_response: true,
          },
        }
      : {
          turn_detection: {
            type: 'semantic_vad',
            eagerness: 'medium',
            create_response: true,
            interrupt_response: true,
          },
        };

  return {
    type: 'session.update',
    session: {
      type: 'realtime',
      instructions,
      output_modalities: ['audio'],
      reasoning: { effort: 'low' },
      parallel_tool_calls: false,
      audio: {
        input,
        output: { voice: 'marin' },
      },
      tools: [shoppingAgentTool],
      tool_choice: 'auto',
    },
  } as const;
}

export const shoppingSessionUpdate = shoppingSessionUpdateFor('phone');
