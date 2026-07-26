import type { AgentResult } from '@/contracts/api';
import { z } from 'zod';

export type RealtimeFunctionCall = {
  type: 'function_call';
  status: 'completed';
  name: 'shopping_agent';
  call_id: string;
  arguments: string;
};

type RealtimeResponseDone = {
  type?: string;
  response?: {
    status?: string;
    output?: unknown[];
  };
};

const realtimeEventSchema = z
  .object({
    type: z.string().optional(),
    response: z
      .object({
        status: z.string().optional(),
        output: z.array(z.unknown()).optional(),
      })
      .passthrough()
      .optional(),
    error: z
      .object({
        message: z.string().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type ParsedRealtimeEvent = z.infer<typeof realtimeEventSchema>;

export function parseRealtimeEvent(raw: unknown): ParsedRealtimeEvent | null {
  if (typeof raw !== 'string') return null;

  try {
    const result = realtimeEventSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function completedShoppingCalls(
  event: RealtimeResponseDone,
): RealtimeFunctionCall[] {
  if (
    event.type !== 'response.done' ||
    event.response?.status !== 'completed'
  ) {
    return [];
  }

  return (event.response.output ?? []).flatMap((item) => {
    const call = item as Partial<RealtimeFunctionCall>;
    return call.type === 'function_call' &&
      call.status === 'completed' &&
      call.name === 'shopping_agent' &&
      typeof call.call_id === 'string' &&
      typeof call.arguments === 'string'
      ? [call as RealtimeFunctionCall]
      : [];
  });
}

export function functionCallOutputEvents(callId: string, result: AgentResult) {
  return [
    {
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output: JSON.stringify(result),
      },
    },
    { type: 'response.create' },
  ] as const;
}

export const initialGreetingEvent = {
  type: 'response.create',
  response: {
    instructions:
      'Greet the customer in one short, natural English sentence and ask what they would like to shop for.',
  },
} as const;
