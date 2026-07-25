import type { AgentResult } from '@/contracts/api';

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
    instructions: '用一句很短、自然的中文问候顾客，并询问想买什么。',
  },
} as const;
