import { describe, expect, it, vi } from "vitest";

import { createOpenAiRealtimeClient } from "../src/adapters/openai-realtime.js";

describe("OpenAI Realtime client-secret adapter", () => {
  it("creates a scoped ephemeral secret with the one shopping tool", async () => {
    const request = vi.fn<typeof fetch>(async (_input, init) => {
      expect(new Headers(init?.headers).get("authorization")).toBe(
        "Bearer server_key",
      );
      const safetyIdentifier = new Headers(init?.headers).get(
        "OpenAI-Safety-Identifier",
      );
      expect(safetyIdentifier).toMatch(/^user_[a-f0-9]{59}$/);
      expect(safetyIdentifier).toHaveLength(64);
      const body = JSON.parse(String(init?.body)) as {
        expires_after: { seconds: number };
        session: {
          instructions: string;
          model: string;
          tools: Array<{ name: string }>;
        };
      };
      expect(body.expires_after.seconds).toBe(600);
      expect(body.session.model).toBe("gpt-realtime-test");
      expect(body.session.tools.map((tool) => tool.name)).toEqual([
        "shopping_agent",
      ]);
      expect(body.session.instructions).toContain("two-stage");
      return Response.json({ value: "ephemeral_value", expires_at: 12345 });
    });
    const client = createOpenAiRealtimeClient({
      apiKey: "server_key",
      model: "gpt-realtime-test",
      fetch: request,
    });

    await expect(client.issueClientSecret("user_alice")).resolves.toEqual({
      value: "ephemeral_value",
      expiresAt: 12345,
    });
  });
});
