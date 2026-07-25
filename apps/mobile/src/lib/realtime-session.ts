import {
  mediaDevices,
  RTCPeerConnection,
  RTCSessionDescription,
  type MediaStream,
} from "react-native-webrtc";

import {
  createToolOutputEvents,
  parseRealtimeEvent,
  type ShoppingAgentRequest,
} from "./realtime-protocol";
import { REALTIME_CALLS_URL, SESSION_UPDATE } from "./realtime-session-config";
import type { AgentResult, VoicePhase } from "@/types/domain";

type RealtimeSessionOptions = {
  getClientSecret: () => Promise<string>;
  handleShoppingRequest: (
    request: ShoppingAgentRequest,
  ) => Promise<AgentResult>;
  onPhaseChange: (phase: VoicePhase) => void;
  onDomainResult: (result: AgentResult) => void;
  onError: (message: string) => void;
};

function readableError(error: unknown) {
  return error instanceof Error && error.message.length < 180
    ? error.message
    : "The voice session stopped unexpectedly.";
}

export class RealtimeShoppingSession {
  private peer: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private channel: ReturnType<RTCPeerConnection["createDataChannel"]> | null =
    null;
  private handledCalls = new Set<string>();
  private generation = 0;
  private sdpAbort: AbortController | null = null;
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly options: RealtimeSessionOptions) {}

  async connect() {
    const attempt = ++this.generation;
    this.cleanupCurrent();
    this.handledCalls.clear();
    this.options.onPhaseChange("connecting");

    let stream: MediaStream | null = null;
    let peer: RTCPeerConnection | null = null;
    let channel: ReturnType<RTCPeerConnection["createDataChannel"]> | null =
      null;

    try {
      stream = await mediaDevices.getUserMedia({ audio: true, video: false });
      if (!this.isCurrent(attempt))
        return this.disposeResources(channel, peer, stream);
      const clientSecret = await this.options.getClientSecret();
      if (!this.isCurrent(attempt))
        return this.disposeResources(channel, peer, stream);

      peer = new RTCPeerConnection();
      channel = peer.createDataChannel("oai-events");
      this.peer = peer;
      this.channel = channel;
      this.localStream = stream;
      stream
        .getTracks()
        .forEach((track) => peer?.addTrack(track, stream as MediaStream));

      channel.onmessage = ((event: unknown) => {
        const data =
          typeof event === "object" && event !== null && "data" in event
            ? event.data
            : undefined;
        if (this.isCurrent(attempt) && typeof data === "string") {
          void this.handleEvent(data, attempt);
        }
      }) as NonNullable<typeof channel.onmessage>;
      channel.onopen = () => {
        if (!this.isCurrent(attempt)) return;
        this.send(SESSION_UPDATE);
        this.send({
          type: "response.create",
          response: {
            instructions:
              "Briefly greet the shopper and ask what they would like to buy.",
          },
        });
        this.options.onPhaseChange("listening");
      };
      channel.onerror = () => {
        this.fail("The voice data channel encountered an error.", attempt);
      };
      peer.onconnectionstatechange = () => {
        if (!this.isCurrent(attempt)) return;
        if (peer?.connectionState === "connected") {
          this.clearDisconnectTimer();
          this.options.onPhaseChange("listening");
        } else if (peer?.connectionState === "disconnected") {
          this.options.onPhaseChange("reconnecting");
          this.clearDisconnectTimer();
          this.disconnectTimer = setTimeout(() => {
            if (peer?.connectionState === "disconnected") {
              this.fail(
                "Voice connection lost. Tap reconnect to continue.",
                attempt,
              );
            }
          }, 2_500);
        } else if (peer?.connectionState === "failed") {
          this.fail(
            "Voice connection failed. Tap reconnect to continue.",
            attempt,
          );
        }
      };

      const offer = await peer.createOffer();
      if (!this.isCurrent(attempt))
        return this.disposeResources(channel, peer, stream);
      if (!offer?.sdp)
        throw new Error(
          "The device could not create a voice connection offer.",
        );
      await peer.setLocalDescription(offer);
      if (!this.isCurrent(attempt))
        return this.disposeResources(channel, peer, stream);

      const controller = new AbortController();
      this.sdpAbort = controller;
      const answer = await fetch(REALTIME_CALLS_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${clientSecret}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp,
        signal: controller.signal,
      });
      if (!this.isCurrent(attempt))
        return this.disposeResources(channel, peer, stream);
      if (!answer.ok) throw new Error("OpenAI could not start the voice call.");
      const answerSdp = await answer.text();
      if (!this.isCurrent(attempt))
        return this.disposeResources(channel, peer, stream);
      await peer.setRemoteDescription(
        new RTCSessionDescription({ type: "answer", sdp: answerSdp }),
      );
      if (!this.isCurrent(attempt))
        return this.disposeResources(channel, peer, stream);
    } catch (error) {
      if (this.isCurrent(attempt)) {
        this.fail(readableError(error), attempt);
      } else {
        this.disposeResources(channel, peer, stream);
      }
    }
  }

  disconnect() {
    this.generation += 1;
    this.cleanupCurrent();
  }

  private async handleEvent(raw: string, attempt: number) {
    let eventType: string | undefined;
    try {
      eventType = (JSON.parse(raw) as { type?: string }).type;
    } catch {
      this.fail("OpenAI sent an unreadable voice event.", attempt);
      return;
    }

    if (eventType === "input_audio_buffer.speech_started")
      this.options.onPhaseChange("listening");
    if (
      eventType === "response.audio.delta" ||
      eventType === "response.output_audio.delta"
    ) {
      this.options.onPhaseChange("speaking");
    }
    if (
      eventType === "response.audio.done" ||
      eventType === "response.output_audio.done"
    ) {
      this.options.onPhaseChange("listening");
    }
    if (eventType === "error")
      return this.fail("OpenAI reported a voice-session error.", attempt);

    const parsed = parseRealtimeEvent(raw);
    if (parsed.kind === "invalid") return this.fail(parsed.reason, attempt);
    if (
      parsed.kind !== "shopping-agent" ||
      this.handledCalls.has(parsed.callId)
    )
      return;

    this.handledCalls.add(parsed.callId);
    this.options.onPhaseChange(
      parsed.request.checkoutConfirmation
        ? "charging"
        : parsed.request.needsPhoto
          ? "capturing"
          : "thinking",
    );
    let result: AgentResult;
    try {
      result = await this.options.handleShoppingRequest(parsed.request);
    } catch (error) {
      result = { status: "error", reason: readableError(error) };
    }
    if (!this.isCurrent(attempt)) return;
    this.options.onDomainResult(result);
    for (const outputEvent of createToolOutputEvents(parsed.callId, result))
      this.send(outputEvent);
    this.options.onPhaseChange("listening");
  }

  private isCurrent(attempt: number) {
    return attempt === this.generation;
  }

  private send(event: unknown) {
    if (this.channel?.readyState === "open")
      this.channel.send(JSON.stringify(event));
  }

  private fail(message: string, attempt: number) {
    if (!this.isCurrent(attempt)) return;
    this.generation += 1;
    this.cleanupCurrent();
    this.options.onPhaseChange("error");
    this.options.onError(message);
  }

  private cleanupCurrent() {
    this.sdpAbort?.abort();
    this.sdpAbort = null;
    this.clearDisconnectTimer();
    this.disposeResources(this.channel, this.peer, this.localStream);
    this.channel = null;
    this.peer = null;
    this.localStream = null;
  }

  private disposeResources(
    channel: ReturnType<RTCPeerConnection["createDataChannel"]> | null,
    peer: RTCPeerConnection | null,
    stream: MediaStream | null,
  ) {
    try {
      channel?.close();
    } catch {}
    try {
      peer?.close();
    } catch {}
    try {
      stream?.getTracks().forEach((track) => track.stop());
      stream?.release(true);
    } catch {}
  }

  private clearDisconnectTimer() {
    if (this.disconnectTimer) clearTimeout(this.disconnectTimer);
    this.disconnectTimer = null;
  }
}
