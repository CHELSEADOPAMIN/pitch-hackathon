import { describe, expect, it } from 'vitest';

import {
  completedShoppingCalls,
  functionCallOutputEvents,
  initialGreetingEvent,
  parseRealtimeEvent,
  realtimeAudioInputSummary,
} from '../../src/realtime/protocol';
import {
  shoppingSessionUpdate,
  shoppingSessionUpdateFor,
} from '../../src/realtime/session-config';

describe('Realtime protocol', () => {
  it('starts a completed shopping call before the whole response finishes', () => {
    const calls = completedShoppingCalls({
      type: 'response.output_item.done',
      item: {
        type: 'function_call',
        status: 'completed',
        name: 'shopping_agent',
        call_id: 'call_early',
        arguments:
          '{"request":"Add the product in view","needs_photo":true}',
      },
    });

    expect(calls).toEqual([
      expect.objectContaining({
        name: 'shopping_agent',
        call_id: 'call_early',
      }),
    ]);
  });

  it('does not run an interrupted or incomplete shopping call early', () => {
    expect(
      completedShoppingCalls({
        type: 'response.output_item.done',
        item: {
          type: 'function_call',
          status: 'incomplete',
          name: 'shopping_agent',
          call_id: 'call_incomplete',
          arguments: '{"request":"Add this","needs_photo":true}',
        },
      }),
    ).toEqual([]);
  });

  it('finds a completed shopping call anywhere in response.done output', () => {
    const calls = completedShoppingCalls({
      type: 'response.done',
      response: {
        status: 'completed',
        output: [
          { type: 'message', role: 'assistant' },
          {
            type: 'function_call',
            status: 'completed',
            name: 'shopping_agent',
            call_id: 'call_123',
            arguments:
              '{"request":"Add the product in view","needs_photo":true}',
          },
        ],
      },
    });

    expect(calls).toEqual([
      expect.objectContaining({
        name: 'shopping_agent',
        call_id: 'call_123',
      }),
    ]);
  });

  it('returns the exact output event followed by response.create', () => {
    const events = functionCallOutputEvents('call_123', {
      status: 'completed',
      action: 'added',
      facts: { product: 'Milk', priceCents: 390 },
    });

    expect(events[0]).toMatchObject({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: 'call_123',
      },
    });
    expect(typeof events[0].item.output).toBe('string');
    expect(JSON.parse(events[0].item.output)).toMatchObject({
      status: 'completed',
      facts: { priceCents: 390 },
    });
    expect(events[1]).toEqual({ type: 'response.create' });
  });

  it('ignores malformed data-channel messages without throwing', () => {
    expect(parseRealtimeEvent('{not-json')).toBeNull();
    expect(parseRealtimeEvent(new Uint8Array())).toBeNull();
    expect(parseRealtimeEvent('{"type":42}')).toBeNull();
  });

  it('configures one serial low-reasoning tool and an initial greeting', () => {
    expect(shoppingSessionUpdate.session.tools).toHaveLength(1);
    expect(shoppingSessionUpdate.session.tools[0].name).toBe('shopping_agent');
    expect(shoppingSessionUpdate.session.parallel_tool_calls).toBe(false);
    expect(shoppingSessionUpdate.session.reasoning.effort).toBe('low');
    expect(shoppingSessionUpdate.session.tool_choice).toBe('auto');
    expect(shoppingSessionUpdate.session.instructions).toContain(
      "I don't want the milk anymore",
    );
    expect(initialGreetingEvent.type).toBe('response.create');
  });

  it('uses near-field noise reduction and stricter server VAD for M02', () => {
    const update = shoppingSessionUpdateFor('m02');

    expect(update.session.audio.input).toMatchObject({
      noise_reduction: { type: 'near_field' },
      turn_detection: {
        type: 'server_vad',
        threshold: 0.65,
        prefix_padding_ms: 300,
        silence_duration_ms: 500,
      },
    });
  });

  it('reads the effective audio input configuration from session.updated', () => {
    const event = parseRealtimeEvent(
      JSON.stringify({
        type: 'session.updated',
        session: {
          audio: {
            input: {
              noise_reduction: { type: 'near_field' },
              turn_detection: { type: 'server_vad', threshold: 0.65 },
            },
          },
        },
      }),
    );

    expect(event).not.toBeNull();
    expect(realtimeAudioInputSummary(event!)).toEqual({
      noiseReduction: 'near_field',
      turnDetection: 'server_vad',
      threshold: 0.65,
    });
  });
});
