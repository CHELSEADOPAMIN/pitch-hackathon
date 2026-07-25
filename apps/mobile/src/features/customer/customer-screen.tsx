import { useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import { useEffect, useRef, useState } from "react";
import { Linking, Pressable, ScrollView, Text, View } from "react-native";

import {
  BodyCopy,
  BrandHeader,
  ErrorNotice,
  PrimaryButton,
  RuleLabel,
  ScreenShell,
  StatusChip,
} from "@/components/ui/demo-ui";
import {
  ProductCamera,
  type ProductCapture,
} from "@/features/customer/product-camera";
import { useRealtimeShopping } from "@/features/customer/use-realtime-shopping";
import { VoiceOrb } from "@/features/customer/voice-orb";
import { useSessionStore } from "@/store/session-store";
import type { AgentResult } from "@/types/domain";

function money(cents: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(cents / 100);
}

function resultCopy(result: AgentResult | null) {
  if (!result)
    return "Hold up a product and speak naturally. No wake word needed.";
  if (result.status === "paid")
    return `Paid ${money(result.totalCents)}. Your order is ready for staff.`;
  if (result.status === "needs_confirmation") {
    return `Quote ready: ${result.items.length} item${result.items.length === 1 ? "" : "s"}, ${money(result.totalCents)}.`;
  }
  if (result.status === "ambiguous") {
    return `Choose one: ${result.candidates.map((candidate) => candidate.name).join(" or ")}.`;
  }
  if (result.status === "not_found")
    return "That product is not in this demo store.";
  if (result.status === "error") return result.reason;
  const product = result.facts.product ?? result.facts.name;
  return typeof product === "string"
    ? `${product} · ${result.action === "added" ? "added" : result.action === "removed" ? "removed" : "cart checked"}`
    : `Cart ${result.action}.`;
}

export function CustomerScreen() {
  const user = useSessionStore((state) => state.user);
  const role = useSessionStore((state) => state.role);
  const toggleRole = useSessionStore((state) => state.toggleRole);
  const logout = useSessionStore((state) => state.logout);
  const captureRef = useRef<ProductCapture>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const requestedRef = useRef(false);
  const [cameraPermission, requestCamera] = useCameraPermissions();
  const [microphonePermission, requestMicrophone] = useMicrophonePermissions();
  const { connect, disconnect, error, lastResult, phase } = useRealtimeShopping(
    user?.id ?? "",
    captureRef,
  );
  const permissionsReady =
    cameraPermission?.granted && microphonePermission?.granted;
  const permanentlyBlocked =
    (cameraPermission &&
      !cameraPermission.granted &&
      !cameraPermission.canAskAgain) ||
    (microphonePermission &&
      !microphonePermission.granted &&
      !microphonePermission.canAskAgain);

  async function askForPermissions() {
    if (permanentlyBlocked) {
      await Linking.openSettings();
      return;
    }
    setPermissionBusy(true);
    setPermissionError(null);
    try {
      const camera = cameraPermission?.granted
        ? cameraPermission
        : await requestCamera();
      const microphone = microphonePermission?.granted
        ? microphonePermission
        : await requestMicrophone();
      if (!camera.granted || !microphone.granted) {
        setPermissionError(
          "Camera and microphone access are both required for hands-free shopping.",
        );
      }
    } finally {
      setPermissionBusy(false);
    }
  }

  useEffect(() => {
    if (
      requestedRef.current ||
      cameraPermission === null ||
      microphonePermission === null ||
      permissionsReady
    ) {
      return;
    }
    requestedRef.current = true;
    void askForPermissions();
  });

  useEffect(() => {
    if (!permissionsReady || !cameraReady || !user) return;
    void connect();
    return disconnect;
  }, [cameraReady, connect, disconnect, permissionsReady, user]);

  if (!permissionsReady) {
    return (
      <ScreenShell>
        <BrandHeader
          caption="DEVICE ACCESS"
          onLogout={logout}
          role={role}
          onRoleSwitch={toggleRole}
        />
        <View className="flex-1 justify-between px-5 pb-8 pt-12">
          <View>
            <Text className="font-mono text-[10px] uppercase tracking-[3px] text-signal">
              EYES + EARS
            </Text>
            <Text className="mt-6 max-w-[340px] font-display text-[48px] leading-[50px] text-paper">
              Let the phone see what you say.
            </Text>
            <View className="mt-7 max-w-[345px]">
              <BodyCopy muted>
                Camera identifies products. Microphone keeps a live
                conversation. Both stay active only while this screen is open.
              </BodyCopy>
            </View>
          </View>
          <View className="gap-4">
            {permissionError ? <ErrorNotice message={permissionError} /> : null}
            <PrimaryButton
              loading={permissionBusy}
              onPress={() => void askForPermissions()}
            >
              {permanentlyBlocked ? "OPEN SETTINGS" : "ALLOW CAMERA + MIC"}
            </PrimaryButton>
          </View>
        </View>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <BrandHeader
        caption={`SHOPPER / ${user?.username ?? "DEMO"}`}
        onLogout={logout}
        role={role}
        onRoleSwitch={toggleRole}
      />
      <ProductCamera onReady={() => setCameraReady(true)} ref={captureRef} />
      <ScrollView contentContainerClassName="px-5 pb-10 pt-5">
        <View className="flex-row flex-wrap gap-2">
          <StatusChip active label="MIC LIVE" />
          <StatusChip
            active={cameraReady}
            label={cameraReady ? "CAM READY" : "CAM WARMING"}
          />
          <StatusChip active={phase !== "error"} label="TEST MODE" />
        </View>
        <VoiceOrb phase={phase} />

        <View className="rounded-[28px] border border-line bg-panel/80 p-5">
          <RuleLabel index="03">LAST SIGNAL</RuleLabel>
          <Text
            accessibilityLiveRegion="polite"
            className="mt-5 font-display text-2xl leading-8 text-paper"
          >
            {resultCopy(lastResult)}
          </Text>
        </View>

        {error ? (
          <View className="mt-4 gap-3">
            <ErrorNotice message={error} />
            <PrimaryButton onPress={() => void connect()}>
              RECONNECT VOICE
            </PrimaryButton>
          </View>
        ) : null}

        <View className="mt-6 gap-3">
          {[
            ["01", "“Add this to my cart”"],
            ["02", "“What have I bought?”"],
            ["03", "“Checkout” — then confirm the quote"],
          ].map(([index, copy]) => (
            <Pressable
              key={index}
              className="flex-row items-center rounded-2xl border border-line px-4 py-4"
            >
              <Text className="mr-4 font-mono text-[10px] text-signal">
                {index}
              </Text>
              <Text className="flex-1 text-sm text-muted">{copy}</Text>
              <Text className="text-muted">↗</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </ScreenShell>
  );
}
