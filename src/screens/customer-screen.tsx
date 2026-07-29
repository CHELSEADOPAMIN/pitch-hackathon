import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
} from 'expo-camera';
import * as Linking from 'expo-linking';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  captureGlassesThumbnail,
  probeGlassesLivePreview,
  requestGlassesPermissions,
} from '@/camera/capture-glasses';
import { captureProduct } from '@/camera/capture-product';
import { ActionButton } from '@/components/action-button';
import { BrandMark } from '@/components/brand-mark';
import { DevRoleSwitch } from '@/components/dev-role-switch';
import { ScreenShell } from '@/components/screen-shell';
import type { LoginResponse } from '@/contracts/api';
import { demoControlsEnabled } from '@/lib/runtime-config';
import {
  type RealtimeStatus,
  useRealtimeShopping,
} from '@/realtime/use-realtime-shopping';
import { useSessionStore } from '@/state/session-store';

const statusCopy: Record<
  RealtimeStatus,
  { eyebrow: string; title: string; detail: string }
> = {
  idle: {
    eyebrow: 'Voice paused',
    title: 'Tap to talk',
    detail: 'Hold a product inside the frame, then start the conversation.',
  },
  connecting: {
    eyebrow: 'Connecting',
    title: 'Opening the line',
    detail: 'Starting a secure voice session.',
  },
  configuring: {
    eyebrow: 'Getting ready',
    title: 'Learning the store',
    detail: 'Loading the catalogue and shopping tools.',
  },
  ready: {
    eyebrow: 'Listening',
    title: 'What would you like?',
    detail: 'Try “add this”, “remove the milk”, or “what is in my cart?”',
  },
  working: {
    eyebrow: 'Working',
    title: 'Checking that',
    detail: 'Identifying the product or updating your cart.',
  },
  error: {
    eyebrow: 'Voice offline',
    title: 'Let’s reconnect',
    detail: 'Keep the app in the foreground, then tap the voice button.',
  },
};

export function CustomerScreen({ session }: { session: LoginResponse }) {
  const cameraRef = useRef<CameraView>(null);
  const requestedPermissions = useRef(false);
  const requestedGlassesPermissions = useRef(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string>();
  const [permissionActionError, setPermissionActionError] = useState<string>();
  const [liveProbeRunning, setLiveProbeRunning] = useState(false);
  const [liveProbeResult, setLiveProbeResult] = useState<string>();
  const [thumbnailProbeRunning, setThumbnailProbeRunning] = useState(false);
  const [thumbnailProbeResult, setThumbnailProbeResult] = useState<string>();
  const [thumbnailProbeUri, setThumbnailProbeUri] = useState<string>();
  const [cameraPermission, requestCameraPermission, getCameraPermission] =
    useCameraPermissions();
  const [
    microphonePermission,
    requestMicrophonePermission,
    getMicrophonePermission,
  ] = useMicrophonePermissions();
  const logout = useSessionStore((state) => state.logout);

  const requestPermissions = useCallback(async () => {
    setPermissionActionError(undefined);
    try {
      await Promise.all([
        requestCameraPermission(),
        requestMicrophonePermission(),
      ]);
    } catch {
      setPermissionActionError(
        'Camera and microphone permissions could not be requested.',
      );
    }
  }, [requestCameraPermission, requestMicrophonePermission]);

  useEffect(() => {
    if (!requestedGlassesPermissions.current) {
      requestedGlassesPermissions.current = true;
      void requestGlassesPermissions();
    }
  }, []);

  useEffect(() => {
    if (
      cameraPermission &&
      microphonePermission &&
      !cameraPermission.granted &&
      !microphonePermission.granted &&
      cameraPermission.canAskAgain &&
      microphonePermission.canAskAgain &&
      !requestedPermissions.current
    ) {
      requestedPermissions.current = true;
      void requestPermissions();
    }
  }, [cameraPermission, microphonePermission, requestPermissions]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void Promise.all([getCameraPermission(), getMicrophonePermission()]);
      }
    });
    return () => subscription.remove();
  }, [getCameraPermission, getMicrophonePermission]);

  const permissionsGranted =
    cameraPermission?.granted === true &&
    microphonePermission?.granted === true;
  const canAskAgain =
    cameraPermission?.canAskAgain !== false &&
    microphonePermission?.canAskAgain !== false;

  const capture = useCallback(
    () => captureProduct(cameraRef, cameraReady),
    [cameraReady],
  );
  const realtime = useRealtimeShopping({
    userId: session.userId,
    enabled: permissionsGranted && cameraReady,
    capture,
  });
  const copy = statusCopy[realtime.status];
  const visibleError = permissionActionError ?? cameraError ?? realtime.error;
  const voiceActive = realtime.status !== 'idle' && realtime.status !== 'error';
  const runLiveProbe = useCallback(async () => {
    setLiveProbeRunning(true);
    setLiveProbeResult('Connecting to M02…');
    try {
      const granted = await requestGlassesPermissions();
      if (!granted) {
        throw new Error('Nearby Bluetooth and Wi-Fi permissions are required.');
      }
      const result = await probeGlassesLivePreview();
      console.info('[PinchGlasses] Live probe', result);
      setLiveProbeResult(
        [
          result.rtspReachable ? 'Live reachable' : 'Live unavailable',
          `advertised=${String(result.advertisedSupport)}`,
          `ack=${String(result.startAcknowledged)}`,
          `ip=${result.glassesIp ?? 'none'}`,
          `p2p=${String(result.p2pConnected)}`,
          `rtsp=${result.rtspStatusLine ?? 'none'}`,
          `ipMs=${result.ipNotificationMs ?? 'n/a'}`,
          `readyMs=${result.rtspReadyMs ?? 'n/a'}`,
          `totalMs=${result.totalMs}`,
          result.error ? `error=${result.error}` : undefined,
        ]
          .filter(Boolean)
          .join(' · '),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'The Live probe failed.';
      console.info('[PinchGlasses] Live probe failed', message);
      setLiveProbeResult(`Live probe failed · ${message}`);
    } finally {
      setLiveProbeRunning(false);
    }
  }, []);
  const runThumbnailProbe = useCallback(async (qualityLevel: number) => {
    setThumbnailProbeRunning(true);
    setThumbnailProbeResult('Connecting to M02…');
    setThumbnailProbeUri(undefined);
    try {
      const granted = await requestGlassesPermissions();
      if (!granted) {
        throw new Error('Nearby Bluetooth permission is required.');
      }
      const result = await captureGlassesThumbnail(qualityLevel);
      console.info('[PinchGlasses] Thumbnail probe', result);
      setThumbnailProbeUri(result.uri);
      setThumbnailProbeResult(
        [
          `${result.qualityName} BLE photo`,
          `${result.width}×${result.height}`,
          `${result.byteCount} bytes`,
          `${result.packetCount} packets`,
          `mtu=${result.negotiatedMtu}`,
          `ack=${result.commandError ?? 'n/a'}/${result.commandWorkType ?? 'n/a'}`,
          `connectMs=${result.connectionMs}`,
          `shutterMs=${result.shutterMs}`,
          `firstChunkMs=${result.firstChunkMs}`,
          `transferMs=${result.transferMs}`,
          `totalMs=${result.totalMs}`,
        ].join(' · '),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'The BLE photo probe failed.';
      console.info('[PinchGlasses] Thumbnail probe failed', message);
      setThumbnailProbeResult(`BLE photo failed · ${message}`);
    } finally {
      setThumbnailProbeRunning(false);
    }
  }, []);

  return (
    <ScreenShell dark>
      {permissionsGranted ? (
        <CameraView
          animateShutter={false}
          facing="back"
          mode="picture"
          onCameraReady={() => {
            setCameraError(undefined);
            setCameraReady(true);
          }}
          onMountError={(event) => {
            setCameraReady(false);
            setCameraError(event.message);
          }}
          ref={cameraRef}
          style={styles.camera}
        />
      ) : null}

      <View pointerEvents="none" style={styles.topScrim} />
      <View pointerEvents="none" style={styles.bottomScrim} />

      <View className="flex-1 px-5 pb-5 pt-4">
        <View className="flex-row items-center justify-between">
          <BrandMark inverse />
          <DevRoleSwitch inverse />
        </View>

        {permissionsGranted ? (
          <View
            pointerEvents="none"
            className="mx-4 my-16 flex-1 rounded-[34px] border border-paper/25"
          >
            <View className="absolute -left-px -top-px h-12 w-12 rounded-tl-[34px] border-l-2 border-t-2 border-signal" />
            <View className="absolute -right-px -top-px h-12 w-12 rounded-tr-[34px] border-r-2 border-t-2 border-signal" />
            <View className="absolute -bottom-px -left-px h-12 w-12 rounded-bl-[34px] border-b-2 border-l-2 border-signal" />
            <View className="absolute -bottom-px -right-px h-12 w-12 rounded-br-[34px] border-b-2 border-r-2 border-signal" />
            <View className="absolute inset-x-0 top-5 items-center">
              <View className="rounded-full bg-ink/55 px-4 py-2">
                <Text className="font-medium text-[10px] uppercase tracking-[2px] text-paper/75">
                  Keep the product in view
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View className="flex-1 justify-center">
            <View className="gap-5 rounded-[30px] border border-paper/15 bg-ink/95 p-6">
              <View className="gap-2">
                <Text className="font-medium text-[10px] uppercase tracking-[2px] text-signal">
                  Permissions needed
                </Text>
                <Text className="font-display text-4xl leading-10 text-paper">
                  Let the app see and hear.
                </Text>
                <Text className="font-sans text-sm leading-6 text-paper/60">
                  The live camera identifies products. The microphone lets you
                  add, remove, review, and buy them by voice.
                </Text>
              </View>
              {permissionActionError ? (
                <Text className="font-sans text-sm text-signal">
                  {permissionActionError}
                </Text>
              ) : null}
              <ActionButton
                onPress={() => {
                  if (canAskAgain) {
                    void requestPermissions();
                  } else {
                    void Linking.openSettings();
                  }
                }}
                tone="signal"
              >
                {canAskAgain ? 'Allow camera and microphone' : 'Open settings'}
              </ActionButton>
            </View>
          </View>
        )}

        <View className="rounded-[30px] border border-paper/15 bg-ink/80 px-5 pb-4 pt-5">
          <View className="flex-row items-center gap-4">
            <Pressable
              accessibilityLabel={
                voiceActive ? 'Pause voice assistant' : 'Start voice assistant'
              }
              accessibilityRole="button"
              disabled={!permissionsGranted || !cameraReady}
              onPress={
                realtime.status === 'error'
                  ? realtime.reconnect
                  : realtime.toggle
              }
              className={`h-16 w-16 items-center justify-center rounded-full border-4 border-paper/15 ${
                voiceActive ? 'bg-signal' : 'bg-leaf'
              } ${
                !permissionsGranted || !cameraReady
                  ? 'opacity-40'
                  : 'active:scale-95'
              }`}
            >
              <View className="flex-row items-center gap-1">
                {[12, 24, 16].map((height) => (
                  <View
                    className="w-1 rounded-full bg-paper"
                    key={height}
                    style={{ height }}
                  />
                ))}
              </View>
            </Pressable>

            <View className="flex-1 gap-1">
              <Text className="font-medium text-[10px] uppercase tracking-[2px] text-signal">
                {copy.eyebrow}
              </Text>
              <Text className="font-display text-[27px] leading-8 text-paper">
                {copy.title}
              </Text>
              <Text className="font-sans text-xs leading-5 text-paper/55">
                {visibleError ?? copy.detail}
              </Text>
            </View>
          </View>

          {demoControlsEnabled() ? (
            <View className="mt-4 gap-2 border-t border-paper/10 pt-3">
              <View className="flex-row gap-2">
                {[0, 2].map((qualityLevel) => (
                  <Pressable
                    accessibilityRole="button"
                    disabled={thumbnailProbeRunning || voiceActive}
                    key={qualityLevel}
                    onPress={() => void runThumbnailProbe(qualityLevel)}
                    className={`flex-1 rounded-full border border-paper/20 px-3 py-2 ${
                      thumbnailProbeRunning || voiceActive
                        ? 'opacity-40'
                        : 'active:opacity-60'
                    }`}
                  >
                    <Text className="text-center font-medium text-xs text-paper/70">
                      {thumbnailProbeRunning
                        ? 'Capturing…'
                        : qualityLevel === 0
                          ? 'BLE Instant photo'
                          : 'BLE Smooth photo'}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {thumbnailProbeResult ? (
                <Text
                  selectable
                  className="font-sans text-[10px] leading-4 text-paper/45"
                >
                  {thumbnailProbeResult}
                </Text>
              ) : null}
              {thumbnailProbeUri ? (
                <Image
                  resizeMode="contain"
                  source={{ uri: thumbnailProbeUri }}
                  className="h-28 w-full rounded-2xl bg-black/25"
                />
              ) : null}
              <Pressable
                accessibilityRole="button"
                disabled={liveProbeRunning || voiceActive}
                onPress={() => void runLiveProbe()}
                className={`rounded-full border border-paper/20 px-4 py-2 ${
                  liveProbeRunning || voiceActive
                    ? 'opacity-40'
                    : 'active:opacity-60'
                }`}
              >
                <Text className="text-center font-medium text-xs text-paper/70">
                  {voiceActive
                    ? 'Pause voice to probe glasses Live'
                    : liveProbeRunning
                      ? 'Probing glasses Live…'
                      : 'Probe glasses Live'}
                </Text>
              </Pressable>
              {liveProbeResult ? (
                <Text
                  selectable
                  className="font-sans text-[10px] leading-4 text-paper/45"
                >
                  {liveProbeResult}
                </Text>
              ) : null}
            </View>
          ) : null}

          <View className="mt-4 flex-row items-center justify-between border-t border-paper/10 pt-3">
            <View>
              <Text className="font-medium text-[9px] uppercase tracking-[1.8px] text-paper/35">
                Shopping as
              </Text>
              <Text className="font-sans text-sm text-paper/80">
                {session.username}
              </Text>
            </View>
            {demoControlsEnabled() ? (
              <Pressable
                accessibilityRole="button"
                onPress={logout}
                className="rounded-full border border-paper/20 px-4 py-2 active:opacity-60"
              >
                <Text className="font-medium text-xs text-paper/70">
                  Sign out
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  camera: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  topScrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    height: 180,
    backgroundColor: 'rgba(20, 24, 18, 0.5)',
  },
  bottomScrim: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    height: 340,
    backgroundColor: 'rgba(20, 24, 18, 0.72)',
  },
});
