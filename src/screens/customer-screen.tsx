import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
} from 'expo-camera';
import * as Linking from 'expo-linking';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  clearCommunicationAudioRoute,
  connectGlasses,
  disconnectGlasses,
  getGlassesStatus,
  type GlassesStatus,
  requestGlassesPermissions,
  selectCommunicationAudioRoute,
  subscribeToGlassesStatus,
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
import {
  type DeviceProfile,
  useDeviceProfileStore,
} from '@/state/device-profile-store';
import { useSessionStore } from '@/state/session-store';

const disconnectedGlassesStatus: GlassesStatus = {
  available: false,
  permissionGranted: false,
  bonded: false,
  connected: false,
};

const statusCopy: Record<
  RealtimeStatus,
  { eyebrow: string; title: string; detail: string }
> = {
  idle: {
    eyebrow: 'Voice paused',
    title: 'Tap to talk',
    detail: 'Look at a product, then start the conversation.',
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

function message(error: unknown) {
  return error instanceof Error ? error.message : 'An unknown error occurred.';
}

export function CustomerScreen({ session }: { session: LoginResponse }) {
  const cameraRef = useRef<CameraView>(null);
  const configurationAttempt = useRef(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string>();
  const [permissionActionError, setPermissionActionError] = useState<string>();
  const [deviceError, setDeviceError] = useState<string>();
  const [deviceConfiguring, setDeviceConfiguring] = useState(true);
  const [audioRouteReady, setAudioRouteReady] = useState(false);
  const [glassesStatus, setGlassesStatus] = useState<GlassesStatus>(
    disconnectedGlassesStatus,
  );
  const [cameraPermission, requestCameraPermission, getCameraPermission] =
    useCameraPermissions();
  const [
    microphonePermission,
    requestMicrophonePermission,
    getMicrophonePermission,
  ] = useMicrophonePermissions();
  const profile = useDeviceProfileStore((state) => state.profile);
  const setProfile = useDeviceProfileStore((state) => state.setProfile);
  const logout = useSessionStore((state) => state.logout);
  const profileRef = useRef(profile);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const configureProfile = useCallback(
    async (nextProfile: DeviceProfile, attempt: number) => {
      setDeviceConfiguring(true);
      setAudioRouteReady(false);
      setDeviceError(undefined);
      setPermissionActionError(undefined);
      try {
        if (nextProfile === 'm02') {
          let microphoneResult = await getMicrophonePermission();
          if (
            !microphoneResult.granted &&
            microphoneResult.canAskAgain !== false
          ) {
            microphoneResult = await requestMicrophonePermission();
          }
          if (!microphoneResult.granted) {
            throw new Error('Microphone permission is required for M02 voice.');
          }
          const glassesPermissionGranted =
            await requestGlassesPermissions();
          if (!glassesPermissionGranted) {
            throw new Error(
              'Nearby-device permission is required to connect M02.',
            );
          }
          const connected = await connectGlasses();
          await selectCommunicationAudioRoute('m02');
          if (configurationAttempt.current === attempt) {
            setGlassesStatus(connected);
          }
        } else {
          let cameraResult = await getCameraPermission();
          if (!cameraResult.granted && cameraResult.canAskAgain !== false) {
            cameraResult = await requestCameraPermission();
          }
          let microphoneResult = await getMicrophonePermission();
          if (
            !microphoneResult.granted &&
            microphoneResult.canAskAgain !== false
          ) {
            microphoneResult = await requestMicrophonePermission();
          }
          if (!cameraResult.granted || !microphoneResult.granted) {
            throw new Error(
              'Camera and microphone permissions are required for Phone mode.',
            );
          }
          await disconnectGlasses();
          await selectCommunicationAudioRoute('phone');
          if (configurationAttempt.current === attempt) {
            setGlassesStatus(disconnectedGlassesStatus);
          }
        }
        if (configurationAttempt.current === attempt) {
          setAudioRouteReady(true);
        }
      } catch (error) {
        if (configurationAttempt.current === attempt) {
          setDeviceError(message(error));
          setAudioRouteReady(false);
        }
      } finally {
        if (configurationAttempt.current === attempt) {
          setDeviceConfiguring(false);
        }
      }
    },
    [
      getCameraPermission,
      getMicrophonePermission,
      requestCameraPermission,
      requestMicrophonePermission,
    ],
  );

  useEffect(() => {
    const attempt = configurationAttempt.current + 1;
    configurationAttempt.current = attempt;
    void configureProfile(profile, attempt);
  }, [configureProfile, profile]);

  useEffect(() => {
    const subscription = subscribeToGlassesStatus((event) => {
      if (profileRef.current !== 'm02') {
        return;
      }
      if (event.stage === 'disconnected' || event.stage === 'error') {
        setGlassesStatus((current) => ({ ...current, connected: false }));
        setDeviceError(event.detail ?? 'The M02 control connection closed.');
        setAudioRouteReady(false);
      } else if (event.stage === 'ready') {
        void getGlassesStatus().then(setGlassesStatus).catch(() => undefined);
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        return;
      }
      void Promise.all([
        getCameraPermission(),
        getMicrophonePermission(),
        profile === 'm02'
          ? getGlassesStatus().then(setGlassesStatus)
          : Promise.resolve(),
      ]);
    });
    return () => subscription.remove();
  }, [getCameraPermission, getMicrophonePermission, profile]);

  useEffect(
    () => () => {
      configurationAttempt.current += 1;
      void disconnectGlasses();
      void clearCommunicationAudioRoute();
    },
    [],
  );

  const phonePermissionsGranted =
    cameraPermission?.granted === true &&
    microphonePermission?.granted === true;
  const m02PermissionsGranted =
    microphonePermission?.granted === true &&
    glassesStatus.permissionGranted === true;
  const deviceReady =
    profile === 'phone'
      ? phonePermissionsGranted && cameraReady
      : m02PermissionsGranted && glassesStatus.connected;
  const canAskAgain =
    microphonePermission?.canAskAgain !== false &&
    (profile === 'm02' || cameraPermission?.canAskAgain !== false);

  const capture = useCallback(
    () => captureProduct(profile, cameraRef, cameraReady),
    [cameraReady, profile],
  );
  const realtime = useRealtimeShopping({
    userId: session.userId,
    enabled: deviceReady && audioRouteReady && !deviceConfiguring,
    capture,
    deviceProfile: profile,
  });
  const copy = statusCopy[realtime.status];
  const visibleError =
    permissionActionError ??
    deviceError ??
    (profile === 'phone' ? cameraError : undefined) ??
    realtime.error;
  const voiceActive = realtime.status !== 'idle' && realtime.status !== 'error';

  useEffect(() => {
    if (realtime.status !== 'ready') {
      return;
    }
    void selectCommunicationAudioRoute(profile).catch((error) => {
      setDeviceError(message(error));
      setAudioRouteReady(false);
    });
  }, [profile, realtime.status]);

  const switchProfile = useCallback(
    (nextProfile: DeviceProfile) => {
      if (
        nextProfile === profile ||
        realtime.status === 'working' ||
        deviceConfiguring
      ) {
        return;
      }
      setAudioRouteReady(false);
      setProfile(nextProfile);
    },
    [deviceConfiguring, profile, realtime.status, setProfile],
  );

  const retryDeviceSetup = useCallback(() => {
    if (!canAskAgain) {
      void Linking.openSettings();
      return;
    }
    const attempt = configurationAttempt.current + 1;
    configurationAttempt.current = attempt;
    void configureProfile(profile, attempt);
  }, [canAskAgain, configureProfile, profile]);

  const modeLabel =
    profile === 'm02'
      ? glassesStatus.deviceName ?? 'M02 glasses'
      : 'Phone camera';

  return (
    <ScreenShell dark>
      {profile === 'phone' && phonePermissionsGranted ? (
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

        <View className="mt-5 flex-row rounded-full border border-paper/15 bg-ink/80 p-1">
          {(
            [
              ['phone', 'Phone'],
              ['m02', glassesStatus.deviceName ?? 'M02'],
            ] as const
          ).map(([value, label]) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: profile === value }}
              disabled={
                realtime.status === 'working' || deviceConfiguring
              }
              key={value}
              onPress={() => switchProfile(value)}
              className={`flex-1 rounded-full px-4 py-3 ${
                profile === value ? 'bg-paper' : ''
              } ${
                realtime.status === 'working' || deviceConfiguring
                  ? 'opacity-60'
                  : ''
              }`}
            >
              <Text
                className={`text-center font-medium text-sm ${
                  profile === value ? 'text-ink' : 'text-paper/65'
                }`}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {deviceReady ? (
          profile === 'phone' ? (
            <View
              pointerEvents="none"
              className="mx-4 my-12 flex-1 rounded-[34px] border border-paper/25"
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
            <View className="flex-1 items-center justify-center px-8">
              <View className="w-full gap-3 rounded-[34px] border border-leaf/50 bg-ink/85 p-7">
                <Text className="font-medium text-[10px] uppercase tracking-[2px] text-leaf">
                  Glasses ready
                </Text>
                <Text className="font-display text-4xl leading-10 text-paper">
                  Look naturally.
                </Text>
                <Text className="font-sans text-sm leading-6 text-paper/60">
                  {modeLabel} will take a Fine BLE photo only when the shopping
                  assistant needs to identify “this”.
                </Text>
              </View>
            </View>
          )
        ) : (
          <View className="flex-1 justify-center">
            <View className="gap-5 rounded-[30px] border border-paper/15 bg-ink/95 p-6">
              <View className="gap-2">
                <Text className="font-medium text-[10px] uppercase tracking-[2px] text-signal">
                  {deviceConfiguring ? 'Connecting device' : 'Setup needed'}
                </Text>
                <Text className="font-display text-4xl leading-10 text-paper">
                  {profile === 'm02'
                    ? 'Connect your glasses.'
                    : 'Let the phone see and hear.'}
                </Text>
                <Text className="font-sans text-sm leading-6 text-paper/60">
                  {visibleError ??
                    (profile === 'm02'
                      ? 'M02 must be paired for call audio and available over Bluetooth.'
                      : 'Phone mode needs the camera and microphone.')}
                </Text>
              </View>
              <ActionButton
                busy={deviceConfiguring}
                onPress={retryDeviceSetup}
                tone="signal"
              >
                {canAskAgain ? 'Try device setup again' : 'Open settings'}
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
              disabled={!deviceReady || !audioRouteReady || deviceConfiguring}
              onPress={
                realtime.status === 'error'
                  ? realtime.reconnect
                  : realtime.toggle
              }
              className={`h-16 w-16 items-center justify-center rounded-full border-4 border-paper/15 ${
                voiceActive ? 'bg-signal' : 'bg-leaf'
              } ${
                !deviceReady || !audioRouteReady || deviceConfiguring
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
                {copy.eyebrow} · {modeLabel}
              </Text>
              <Text className="font-display text-[27px] leading-8 text-paper">
                {copy.title}
              </Text>
              <Text className="font-sans text-xs leading-5 text-paper/55">
                {visibleError ?? copy.detail}
              </Text>
            </View>
          </View>

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
