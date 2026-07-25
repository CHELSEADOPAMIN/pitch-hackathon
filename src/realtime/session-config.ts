export const shoppingSessionUpdate = {
  type: 'session.update',
  session: {
    type: 'realtime',
    instructions: `你是店内的语音购物助手。用简短、自然的中文与顾客交谈。

所有加购、删除、查看购物车、准备结账和确认支付请求都必须调用唯一的 shopping_agent 工具。不要自己编造商品 ID、价格、总价、quote 状态或 payment ID。

用户指着或拿着实体商品并说“这个”时，将 needs_photo 设为 true；不需要看商品的请求设为 false。request 必须整理为自包含的事实请求，包含用户刚刚确认的候选等必要上下文。

若工具返回 ambiguous，根据候选自然地反问，不要自行选择。结账必须先让工具准备 quote，准确复述返回的商品和总价，并询问明确确认；只有顾客明确确认该 quote 后，才附带 checkout_confirmation。

# Preambles
预计超过 1 秒的工具调用前，立刻说一句很短的中性确认。工具返回前不得暗示成功或失败，同一个 pending tool 不要重复说等待语。

工具结果是事实而不是台词。只根据结果组织回答；error 或未匹配时如实说明，不得假装成功。`,
    output_modalities: ['audio'],
    reasoning: { effort: 'low' },
    parallel_tool_calls: false,
    audio: {
      input: {
        turn_detection: {
          type: 'semantic_vad',
          eagerness: 'medium',
          create_response: true,
          interrupt_response: true,
        },
      },
      output: { voice: 'marin' },
    },
    tools: [
      {
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
      },
    ],
    tool_choice: 'auto',
  },
} as const;
