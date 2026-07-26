import { createHash } from 'node:crypto';

import { z } from 'zod';

const realtimeSecretSchema = z
  .object({
    value: z.string(),
    expires_at: z.number(),
  })
  .passthrough();

export type RealtimeSecret = z.infer<typeof realtimeSecretSchema>;

export class OpenAIRealtimeClient {
  constructor(
    private readonly apiKey: string,
    private readonly fetch: typeof globalThis.fetch = globalThis.fetch,
  ) {}

  async createClientSecret(userId: string): Promise<RealtimeSecret> {
    const safetyIdentifier = createHash('sha256').update(userId).digest('hex');
    const response = await this.fetch(
      'https://api.openai.com/v1/realtime/client_secrets',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Safety-Identifier': safetyIdentifier,
        },
        body: JSON.stringify({
          expires_after: {
            anchor: 'created_at',
            seconds: 600,
          },
          session: {
            type: 'realtime',
            model: 'gpt-realtime-2.1',
            instructions:
              'You are an in-store shopping assistant. Speak only concise, natural English. Use the shopping tool for every add, remove, cart, quote, and payment action. Treat phrases such as “I do not want this anymore” as removal requests.',
            audio: {
              output: {
                voice: 'marin',
              },
            },
          },
        }),
      },
    );

    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;
    if (!response.ok) {
      throw new Error(
        `OpenAI Realtime ${response.status}: ${JSON.stringify(payload)}`,
      );
    }
    return realtimeSecretSchema.parse(payload);
  }
}
