import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";

import { createTerraShoppingAgent } from "../src/agent/terra-shopping-agent.js";
import { createInMemoryShoppingRepository } from "../src/domain/in-memory-repository.js";
import { createShoppingDomain } from "../src/domain/shopping-domain.js";

const usage = {
  inputTokens: {
    total: 1,
    noCache: 1,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 1, text: 1, reasoning: undefined },
};

describe("Terra shopping agent", () => {
  it("returns the last deterministic tool result instead of model-authored text", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: [
        {
          content: [
            {
              type: "tool-call",
              toolCallId: "call_1",
              toolName: "get_cart",
              input: "{}",
            },
          ],
          finishReason: { unified: "tool-calls", raw: undefined },
          usage,
          warnings: [],
        },
        {
          content: [{ type: "text", text: "The total is a made-up amount." }],
          finishReason: { unified: "stop", raw: undefined },
          usage,
          warnings: [],
        },
      ],
    });
    const domain = createShoppingDomain({
      repository: createInMemoryShoppingRepository({
        users: [{ id: "user_alice", username: "alice" }],
      }),
    });
    const agent = createTerraShoppingAgent({ domain, model });

    const result = await agent.run({
      userId: "user_alice",
      request: "What is in my cart?",
    });

    expect(result).toEqual({
      status: "completed",
      action: "cart",
      facts: { items: [], cartCount: 0, totalCents: 0 },
    });
  });
});
