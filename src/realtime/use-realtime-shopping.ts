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
import {
  completedShoppingCalls,
  functionCallOutputEvents,
  initialGreetingEvent,
  parseRealtimeEvent,
  type RealtimeFunctionCall,
} from '@/realtime/protocol';
import { shoppingSessionUpdate } from '@/realtime/session-config';

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

export type RealtimeStatus =
  'idle' | 'connecting' | 'configuring' | 'ready' | 'working' | 'error';

type UseRealtimeShoppingOptions = {
  userId: string;
  enabled: boolean;
  capture: () => Promise<string>;
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'An unknown error occurred.';
}

export function useRealtimeShopping({
  userId,
  enabled,
  capture,
}: UseRealtimeShoppingOptions) {
  const [status, setStatus] = useState<RealtimeStatus>('idle');
  const [error, setError] = useState<string>();
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const handledCallsRef = useRef(new Set<string>());
  const toolQueueRef = useRef<Promise<void>>(Promise.resolve());
  const connectionAttemptRef = useRef(0);

  const disconnect = useCallback((resetStatus = true) => {
    connectionAttemptRef.current += 1;
    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    remoteStreamRef.current = null;
    handledCallsRef.current.clear();
    if (resetStatus) setStatus('idle');
  }, []);

  const executeFunctionCall = useCallback(
    async (
      call: RealtimeFunctionCall,
      attempt: number,
      channel: DataChannel,
    ) => {
      if (
        connectionAttemptRef.current !== attempt ||
        channel.readyState !== 'open'
      ) {
        return;
      }
      if (handledCallsRef.current.has(call.call_id)) {
        return;
      }

      handledCallsRef.current.add(call.call_id);
      setStatus('working');

      let output: AgentResult;
      try {
        const input = shoppingToolArgumentsSchema.parse(
          JSON.parse(call.arguments),
        );
        const imageBase64 = input.needs_photo ? await capture() : undefined;
        const response = await api.api.agent.$post({
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
          },
        });
        output = await readJson(response, agentResultSchema);
      } catch (cause) {
        output = {
          status: 'error',
          reason: errorMessage(cause),
        };
      }

      if (
        connectionAttemptRef.current !== attempt ||
        channel.readyState !== 'open'
      ) {
        return;
      }

      try {
        for (const event of functionCallOutputEvents(call.call_id, output)) {
          channel.send(JSON.stringify(event));
        }
        setStatus('ready');
      } catch (cause) {
        if (connectionAttemptRef.current === attempt) {
          setError(errorMessage(cause));
          setStatus('error');
        }
      }
    },
    [capture, userId],
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
        send(shoppingSessionUpdate);
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
          if (!greeted) {
            greeted = true;
            send(initialGreetingEvent);
          }
          setStatus('ready');
          return;
        }

        if (realtimeEvent.type === 'error') {
          setError(
            realtimeEvent.error?.message ?? 'The Realtime session failed.',
          );
          setStatus('error');
          return;
        }

        for (const call of completedShoppingCalls(realtimeEvent)) {
          toolQueueRef.current = toolQueueRef.current.then(() =>
            executeFunctionCall(call, attempt, channel),
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
  }, [enabled, executeFunctionCall, userId]);

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
