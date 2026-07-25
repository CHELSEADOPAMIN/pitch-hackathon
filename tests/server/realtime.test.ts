import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { OpenAIRealtimeClient } from '../../server/integrations/realtime';

describe('OpenAIRealtimeClient', () => {
  it('mints a GA client secret with a de-identified safety identifier', async () => {
    const requests: Array<{ input: string; init: RequestInit }> = [];
    const fetch = async (input: string | URL | Request, init?: RequestInit) => {
      requests.push({ input: String(input), init: init ?? {} });
      return new Response(
        JSON.stringify({
          value: 'ek_test',
          expires_at: 1234,
          session: { type: 'realtime' },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    };
    const client = new OpenAIRealtimeClient(
      'server_key',
      fetch as typeof globalThis.fetch,
    );

    const result = await client.createClientSecret('user_123');

    expect(result).toMatchObject({ value: 'ek_test', expires_at: 1234 });
    expect(requests).toHaveLength(1);
    expect(requests[0].input).toBe(
      'https://api.openai.com/v1/realtime/client_secrets',
    );
    expect(requests[0].init.headers).toEqual({
      Authorization: 'Bearer server_key',
      'Content-Type': 'application/json',
      'OpenAI-Safety-Identifier': createHash('sha256')
        .update('user_123')
        .digest('hex'),
    });
    expect(JSON.parse(String(requests[0].init.body))).toEqual({
      expires_after: { anchor: 'created_at', seconds: 600 },
      session: {
        type: 'realtime',
        model: 'gpt-realtime-2.1',
        audio: { output: { voice: 'marin' } },
      },
    });
  });
});
