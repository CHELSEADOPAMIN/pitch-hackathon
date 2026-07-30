import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MediaStream,
  mediaDevices,
  RTCPeerConnection,
} from 'react-native-webrtc';
import { z } from 'zod';

import {
  type AgentResult,
  agentResultSchema,
  realtimeTokenResponseSchema,
} from '@/contracts/api';
import { api, readJson } from '@/lib/api';
import { logDiagnosticEvent } from '@/lib/diagnostic-log';
import {
  completedShoppingCalls,
  functionCallOutputEvents,
  initialGreetingEvent,
  parseRealtimeEvent,
  realtimeAudioInputSummary,
  TOOL_PROGRESS_DELAY_MS,
  toolProgressEvent,
  type RealtimeFunctionCall,
} from '@/realtime/protocol';
import { shoppingSessionUpdateFor } from '@/realtime/session-config';
import type { DeviceProfile } from '@/state/device-profile-store';

const shoppingToolArgumentsSchema = z.object({
  request: z.string().min(1),
  needs_photo: z.boolean(),
  checkout_confirmation: z
    .object({
      quote_id: z.string().min(1),
      confirmed: z.literal(true),
    })
    .optional(),
});

type DataChannel = ReturnType<RTCPeerConnection['createDataChannel']>;

type ShoppingCallTrace = {
  callId: string;
  toolCallReceivedAt: number;
  speechStartedAt?: number;
  speechStoppedAt?: number;
  executionStartedAt?: number;
  toolResultSentAt?: number;
};

type RealtimeResponseTrace = {
  callId: string;
  purpose: string;
};

export type RealtimeStatus =
  'idle' | 'connecting' | 'configuring' | 'ready' | 'working' | 'error';

type UseRealtimeShoppingOptions = {
  userId: string;
  enabled: boolean;
  capture: () => Promise<string>;
  deviceProfile: DeviceProfile;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'An unknown error occurred.';
}

export function useRealtimeShopping({
  userId,
  enabled,
  capture,
  deviceProfile,
}: UseRealtimeShoppingOptions) {
  const [status, setStatus] = useState<RealtimeStatus>('idle');
  const [error, setError] = useState<string>();
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const handledCallsRef = useRef(new Set<string>());
  const toolQueueRef = useRef<Promise<void>>(Promise.resolve());
  const connectionAttemptRef = useRef(0);
  const callTracesRef = useRef(new Map<string, ShoppingCallTrace>());
  const responseTracesRef = useRef(new Map<string, RealtimeResponseTrace>());
  const lastSpeechStartedAtRef = useRef<number | undefined>(undefined);
  const lastSpeechStoppedAtRef = useRef<number | undefined>(undefined);

  const disconnect = useCallback((resetStatus = true) => {
    connectionAttemptRef.current += 1;
    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    handledCallsRef.current.clear();
    callTracesRef.current.clear();
    responseTracesRef.current.clear();
    lastSpeechStartedAtRef.current = undefined;
    lastSpeechStoppedAtRef.current = undefined;
    if (resetStatus) setStatus('idle');
  }, []);

  const executeFunctionCall = useCallback(
    async (
      call: RealtimeFunctionCall,
      attempt: number,
      channel: DataChannel,
      trace: ShoppingCallTrace,
    ) => {
      if (
        connectionAttemptRef.current !== attempt ||
        channel.readyState !== 'open'
      ) {
        return;
      }
      setStatus('working');

      const startedAt = Date.now();
      trace.executionStartedAt = startedAt;
      logDiagnosticEvent('shopping_tool_execution_started', {
        callId: call.call_id,
        deviceProfile,
        queueMs: startedAt - trace.toolCallReceivedAt,
        speechStoppedToExecutionMs: trace.speechStoppedAt
          ? startedAt - trace.speechStoppedAt
          : undefined,
      });

      let captureStartedAt: number | undefined;
      let agentStartedAt: number | undefined;
      let captureMs = 0;
      let agentMs = 0;
      let currentStage = 'arguments';
      let progressTimer: ReturnType<typeof setTimeout> | undefined;
      let output: AgentResult;
      try {
        const input = shoppingToolArgumentsSchema.parse(
          JSON.parse(call.arguments),
        );
        progressTimer = setTimeout(() => {
          if (
            connectionAttemptRef.current !== attempt ||
            channel.readyState !== 'open'
          ) {
            return;
          }
          try {
            channel.send(JSON.stringify(toolProgressEvent(call.call_id)));
            logDiagnosticEvent('shopping_progress_response_requested', {
              callId: call.call_id,
              elapsedMs: Date.now() - startedAt,
            });
          } catch (cause) {
            console.warn(
              '[shopping] Could not send pending-tool progress update.',
              errorMessage(cause),
            );
          }
        }, TOOL_PROGRESS_DELAY_MS);

        currentStage = 'capture';
        captureStartedAt = input.needs_photo ? Date.now() : undefined;
        if (captureStartedAt !== undefined) {
          logDiagnosticEvent('shopping_capture_started', {
            callId: call.call_id,
            deviceProfile,
          });
        }
        const imageBase64 = input.needs_photo ? await capture() : undefined;
        if (captureStartedAt !== undefined) {
          captureMs = Date.now() - captureStartedAt;
          logDiagnosticEvent('shopping_capture_completed', {
            callId: call.call_id,
            deviceProfile,
            captureMs,
            imageBase64Chars: imageBase64?.length ?? 0,
          });
        }

        currentStage = 'agent_http';
        agentStartedAt = Date.now();
        logDiagnosticEvent('shopping_agent_http_started', {
          callId: call.call_id,
          hasImage: Boolean(imageBase64),
          imageBase64Chars: imageBase64?.length ?? 0,
        });
        const response = await api.api.agent.$post(
          {
            json: {
              userId,
              request: input.request,
              imageBase64,
              checkoutConfirmation: input.checkout_confirmation
                ? {
                    quoteId: input.checkout_confirmation.quote_id,
                    confirmed: true,
                  }
                : undefined,
              traceId: call.call_id,
            },
          },
          {
            headers: {
              'x-correlation-id': call.call_id,
            },
          },
        );
        const responseHeadersAt = Date.now();
        logDiagnosticEvent('shopping_agent_http_headers_received', {
          callId: call.call_id,
          correlationId:
            response.headers.get('x-correlation-id') ?? call.call_id,
          httpStatus: response.status,
          headersMs: responseHeadersAt - agentStartedAt,
        });
        output = await readJson(response, agentResultSchema);
        agentMs = Date.now() - agentStartedAt;
      } catch (cause) {
        logDiagnosticEvent('shopping_tool_execution_failed', {
          callId: call.call_id,
          stage: currentStage,
          elapsedMs: Date.now() - startedAt,
          error: errorMessage(cause),
        });
        output = {
          status: 'error',
          reason: errorMessage(cause),
        };
      } finally {
        if (progressTimer) clearTimeout(progressTimer);
        if (captureStartedAt !== undefined && captureMs === 0) {
          captureMs = Date.now() - captureStartedAt;
        }
        if (agentStartedAt !== undefined && agentMs === 0) {
          agentMs = Date.now() - agentStartedAt;
        }
      }

      logDiagnosticEvent('shopping_tool_completed', {
        callId: call.call_id,
        deviceProfile,
        captureMs,
        agentMs,
        totalMs: Date.now() - startedAt,
        outcome:
          output.status === 'completed'
            ? output.action
            : output.status === 'error'
              ? output.reason
              : output.status,
      });

      if (
        connectionAttemptRef.current !== attempt ||
        channel.readyState !== 'open'
      ) {
        return;
      }

      try {
        trace.toolResultSentAt = Date.now();
        for (const event of functionCallOutputEvents(call.call_id, output)) {
          channel.send(JSON.stringify(event));
        }
        logDiagnosticEvent('shopping_tool_result_sent', {
          callId: call.call_id,
          toolCallToResultMs: trace.toolResultSentAt - trace.toolCallReceivedAt,
          executionMs: trace.executionStartedAt
            ? trace.toolResultSentAt - trace.executionStartedAt
            : undefined,
        });
        setStatus('ready');
      } catch (cause) {
        if (connectionAttemptRef.current === attempt) {
          setError(errorMessage(cause));
          setStatus('error');
        }
      }
    },
    [capture, deviceProfile, userId],
  );

  const connect = useCallback(async () => {
    if (!enabled || peerRef.current) {
      return;
    }

    const attempt = connectionAttemptRef.current + 1;
    connectionAttemptRef.current = attempt;
    setError(undefined);
    setStatus('connecting');

    let peer: RTCPeerConnection | undefined;
    let stream: MediaStream | undefined;

    try {
      peer = new RTCPeerConnection();
      peerRef.current = peer;
      const channel = peer.createDataChannel('oai-events');
      const send = (event: object) => channel.send(JSON.stringify(event));
      let greeted = false;

      channel.onopen = () => {
        if (connectionAttemptRef.current !== attempt) return;
        setStatus('configuring');
        send(shoppingSessionUpdateFor(deviceProfile));
      };

      channel.onmessage = (event: unknown) => {
        if (connectionAttemptRef.current !== attempt) return;

        const realtimeEvent = parseRealtimeEvent(
          (event as { data?: unknown }).data,
        );
        if (!realtimeEvent) {
          console.warn('[realtime] Ignored a malformed data-channel event.');
          return;
        }

        if (realtimeEvent.type === 'session.updated') {
          console.info(
            `[realtime] ${deviceProfile} audio input configured`,
            realtimeAudioInputSummary(realtimeEvent),
          );
          if (!greeted) {
            greeted = true;
            send(initialGreetingEvent);
          }
          setStatus('ready');
          return;
        }

        if (
          realtimeEvent.type === 'input_audio_buffer.speech_started' ||
          realtimeEvent.type === 'input_audio_buffer.speech_stopped'
        ) {
          const now = Date.now();
          if (realtimeEvent.type === 'input_audio_buffer.speech_started') {
            lastSpeechStartedAtRef.current = now;
          } else {
            lastSpeechStoppedAtRef.current = now;
          }
          logDiagnosticEvent(realtimeEvent.type, {
            deviceProfile,
          });
        }

        if (realtimeEvent.type === 'error') {
          setError(
            realtimeEvent.error?.message ?? 'The Realtime session failed.',
          );
          setStatus('error');
          return;
        }

        const responseId = realtimeEvent.response?.id;
        const responsePurpose =
          realtimeEvent.response?.metadata?.response_purpose;
        const responseCallId = realtimeEvent.response?.metadata?.call_id;
        if (
          responseId &&
          responsePurpose &&
          responseCallId &&
          (realtimeEvent.type === 'response.created' ||
            realtimeEvent.type === 'response.done')
        ) {
          responseTracesRef.current.set(responseId, {
            callId: responseCallId,
            purpose: responsePurpose,
          });
          const trace = callTracesRef.current.get(responseCallId);
          logDiagnosticEvent(`realtime_${realtimeEvent.type}`, {
            callId: responseCallId,
            responseId,
            responsePurpose,
            toolResultToEventMs: trace?.toolResultSentAt
              ? Date.now() - trace.toolResultSentAt
              : undefined,
            toolCallToEventMs: trace
              ? Date.now() - trace.toolCallReceivedAt
              : undefined,
          });
        }

        if (
          realtimeEvent.type === 'output_audio_buffer.stopped' &&
          realtimeEvent.response_id
        ) {
          const responseTrace = responseTracesRef.current.get(
            realtimeEvent.response_id,
          );
          if (responseTrace) {
            const trace = callTracesRef.current.get(responseTrace.callId);
            logDiagnosticEvent('realtime_output_audio_buffer_stopped', {
              callId: responseTrace.callId,
              responseId: realtimeEvent.response_id,
              responsePurpose: responseTrace.purpose,
              toolResultToPlaybackEndMs: trace?.toolResultSentAt
                ? Date.now() - trace.toolResultSentAt
                : undefined,
              toolCallToPlaybackEndMs: trace
                ? Date.now() - trace.toolCallReceivedAt
                : undefined,
              speechStoppedToPlaybackEndMs: trace?.speechStoppedAt
                ? Date.now() - trace.speechStoppedAt
                : undefined,
            });
            responseTracesRef.current.delete(realtimeEvent.response_id);
            if (responseTrace.purpose === 'shopping_result') {
              callTracesRef.current.delete(responseTrace.callId);
            }
          }
        }

        for (const call of completedShoppingCalls(realtimeEvent)) {
          if (handledCallsRef.current.has(call.call_id)) {
            continue;
          }
          handledCallsRef.current.add(call.call_id);
          const receivedAt = Date.now();
          const trace: ShoppingCallTrace = {
            callId: call.call_id,
            toolCallReceivedAt: receivedAt,
            speechStartedAt: lastSpeechStartedAtRef.current,
            speechStoppedAt: lastSpeechStoppedAtRef.current,
          };
          callTracesRef.current.set(call.call_id, trace);
          logDiagnosticEvent('realtime_shopping_tool_call_received', {
            callId: call.call_id,
            deviceProfile,
            needsPhoto: (() => {
              try {
                return shoppingToolArgumentsSchema.parse(
                  JSON.parse(call.arguments),
                ).needs_photo;
              } catch {
                return undefined;
              }
            })(),
            speechStartedToToolCallMs: trace.speechStartedAt
              ? receivedAt - trace.speechStartedAt
              : undefined,
            speechStoppedToToolCallMs: trace.speechStoppedAt
              ? receivedAt - trace.speechStoppedAt
              : undefined,
          });
          toolQueueRef.current = toolQueueRef.current.then(() =>
            executeFunctionCall(call, attempt, channel, trace),
          );
        }
      };

      peer.ontrack = (event: unknown) => {
        if (connectionAttemptRef.current !== attempt) return;
        remoteStreamRef.current = (
          event as { streams: MediaStream[] }
        ).streams[0];
      };
      peer.onconnectionstatechange = () => {
        if (
          connectionAttemptRef.current === attempt &&
          peer?.connectionState === 'failed'
        ) {
          setError('The Realtime audio connection failed.');
          setStatus('error');
        }
      };

      const tokenPromise = api.api['realtime-token']
        .$post({ json: { userId } })
        .then((response) => readJson(response, realtimeTokenResponseSchema));
      const mediaPromise = mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      const [tokenResult, mediaResult] = await Promise.allSettled([
        tokenPromise,
        mediaPromise,
      ]);
      if (mediaResult.status === 'fulfilled') {
        stream = mediaResult.value;
      }
      if (tokenResult.status === 'rejected') {
        throw tokenResult.reason;
      }
      if (mediaResult.status === 'rejected') {
        throw mediaResult.reason;
      }

      const { value: ephemeralKey } = tokenResult.value;
      const localStream = mediaResult.value;

      if (connectionAttemptRef.current !== attempt) {
        localStream.getTracks().forEach((track) => track.stop());
        peer.close();
        return;
      }

      localStreamRef.current = localStream;
      const audioTrack = localStream.getAudioTracks()[0];
      peer.addTrack(audioTrack, localStream);

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const sdpResponse = await fetch(
        'https://api.openai.com/v1/realtime/calls',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${ephemeralKey}`,
            'Content-Type': 'application/sdp',
          },
          body: offer.sdp,
        },
      );
      if (!sdpResponse.ok) {
        throw new Error(
          `The Realtime audio handshake failed (${sdpResponse.status}).`,
        );
      }
      await peer.setRemoteDescription({
        type: 'answer',
        sdp: await sdpResponse.text(),
      });
    } catch (cause) {
      peer?.close();
      stream?.getTracks().forEach((track) => track.stop());
      if (connectionAttemptRef.current === attempt) {
        if (peerRef.current === peer) peerRef.current = null;
        if (localStreamRef.current === stream) {
          localStreamRef.current = null;
        }
        setError(errorMessage(cause));
        setStatus('error');
      }
    }
  }, [deviceProfile, enabled, executeFunctionCall, userId]);

  useEffect(() => {
    const start = enabled ? setTimeout(() => void connect(), 0) : undefined;
    return () => {
      if (start !== undefined) clearTimeout(start);
      disconnect(false);
    };
  }, [connect, disconnect, enabled]);

  const reconnect = useCallback(() => {
    disconnect();
    void connect();
  }, [connect, disconnect]);

  const toggle = useCallback(() => {
    if (peerRef.current) {
      disconnect();
      return;
    }
    void connect();
  }, [connect, disconnect]);

  return {
    status,
    error,
    reconnect,
    toggle,
  };
}
