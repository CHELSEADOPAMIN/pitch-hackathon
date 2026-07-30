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
  item?: unknown;
  response_id?: string;
  response?: {
    id?: string;
    status?: string;
    output?: unknown[];
    metadata?: Record<string, string>;
  };
};

const realtimeEventSchema = z
  .object({
    type: z.string().optional(),
    session: z
      .object({
        audio: z
          .object({
            input: z
              .object({
                noise_reduction: z
                  .object({
                    type: z.string().optional(),
                  })
                  .passthrough()
                  .nullable()
                  .optional(),
                turn_detection: z
                  .object({
                    type: z.string().optional(),
                    threshold: z.number().optional(),
                  })
                  .passthrough()
                  .nullable()
                  .optional(),
              })
              .passthrough()
              .optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .optional(),
    response: z
      .object({
        id: z.string().optional(),
        status: z.string().optional(),
        output: z.array(z.unknown()).optional(),
        metadata: z.record(z.string(), z.string()).optional(),
      })
      .passthrough()
      .optional(),
    response_id: z.string().optional(),
    item: z.unknown().optional(),
    error: z
      .object({
        message: z.string().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type ParsedRealtimeEvent = z.infer<typeof realtimeEventSchema>;

export function realtimeAudioInputSummary(event: ParsedRealtimeEvent) {
  const input = event.session?.audio?.input;
  return {
    noiseReduction: input?.noise_reduction?.type,
    turnDetection: input?.turn_detection?.type,
    threshold: input?.turn_detection?.threshold,
  };
}

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
  if (event.type === 'response.output_item.done') {
    const call = completedShoppingCall(event.item);
    return call ? [call] : [];
  }

  if (
    event.type !== 'response.done' ||
    event.response?.status !== 'completed'
  ) {
    return [];
  }

  return (event.response.output ?? []).flatMap((item) => {
    const call = completedShoppingCall(item);
    return call ? [call] : [];
  });
}

function completedShoppingCall(item: unknown): RealtimeFunctionCall | null {
  const call = item as Partial<RealtimeFunctionCall> | undefined;
  return call?.type === 'function_call' &&
    call.status === 'completed' &&
    call.name === 'shopping_agent' &&
    typeof call.call_id === 'string' &&
    typeof call.arguments === 'string'
    ? (call as RealtimeFunctionCall)
    : null;
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
    {
      type: 'response.create',
      response: {
        metadata: {
          response_purpose: 'shopping_result',
          call_id: callId,
        },
      },
    },
  ] as const;
}

export const TOOL_PROGRESS_DELAY_MS = 7_000;

export function toolProgressEvent(callId: string) {
  return {
    type: 'response.create',
    response: {
      conversation: 'none',
      input: [],
      instructions:
        'Say exactly: "Still working. One moment." Do not say anything else.',
      tools: [],
      tool_choice: 'none',
      output_modalities: ['audio'],
      max_output_tokens: 64,
      metadata: {
        response_purpose: 'tool_progress',
        call_id: callId,
      },
    },
  } as const;
}

export const initialGreetingEvent = {
  type: 'response.create',
  response: {
    instructions:
      'Greet the customer in one short, natural English sentence and ask what they would like to shop for.',
  },
} as const;
