import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

import type { ProductCapture } from "@/features/customer/product-camera";
import { getRealtimeClientSecret, runShoppingAgent } from "@/lib/api-client";
import { RealtimeShoppingSession } from "@/lib/realtime-session";
import type { AgentResult, VoicePhase } from "@/types/domain";

export function useRealtimeShopping(
  userId: string,
  captureRef: RefObject<ProductCapture | null>,
) {
  const sessionRef = useRef<RealtimeShoppingSession | null>(null);
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<AgentResult | null>(null);

  const disconnect = useCallback(() => {
    sessionRef.current?.disconnect();
    sessionRef.current = null;
    setPhase("idle");
  }, []);

  const connect = useCallback(async () => {
    sessionRef.current?.disconnect();
    setError(null);
    const session = new RealtimeShoppingSession({
      getClientSecret: () => getRealtimeClientSecret(userId),
      onPhaseChange: setPhase,
      onDomainResult: setLastResult,
      onError: setError,
      handleShoppingRequest: async (request) => {
        let imageBase64: string | undefined;
        if (request.needsPhoto) {
          if (!captureRef.current)
            throw new Error("The product camera is unavailable.");
          imageBase64 = await captureRef.current.capture();
          setPhase("thinking");
        }
        return runShoppingAgent({
          userId,
          request: request.request,
          imageBase64,
          checkoutConfirmation: request.checkoutConfirmation,
        });
      },
    });
    sessionRef.current = session;
    await session.connect();
  }, [captureRef, userId]);

  useEffect(() => () => sessionRef.current?.disconnect(), []);

  return { connect, disconnect, error, lastResult, phase };
}
