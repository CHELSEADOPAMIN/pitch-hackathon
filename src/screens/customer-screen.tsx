import { Camera, CameraView } from 'expo-camera';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { captureProduct } from '@/camera/capture-product';
import { ActionButton } from '@/components/action-button';
import { BrandMark } from '@/components/brand-mark';
import { DevRoleSwitch } from '@/components/dev-role-switch';
import { ScreenShell } from '@/components/screen-shell';
import type { LoginResponse } from '@/contracts/api';
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
    eyebrow: '准备中',
    title: '正在唤醒',
    detail: '相机与麦克风准备好后，会自动开始聆听。',
  },
  connecting: {
    eyebrow: '正在连接',
    title: '马上就好',
    detail: '正在建立 OpenAI Realtime 音频会话。',
  },
  configuring: {
    eyebrow: '正在配置',
    title: '让我熟悉商店',
    detail: '购物工具与语音策略正在就绪。',
  },
  ready: {
    eyebrow: '正在聆听',
    title: '你想买什么？',
    detail: '拿起商品，直接说“把这个加入购物车”。',
  },
  working: {
    eyebrow: '购物助手处理中',
    title: '我看一下',
    detail: '正在识别商品或处理你的购物请求。',
  },
  error: {
    eyebrow: '连接中断',
    title: '暂时没听见',
    detail: '保持 App 在前台，然后重新连接。',
  },
};

export function CustomerScreen({ session }: { session: LoginResponse }) {
  const cameraRef = useRef<CameraView>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [permissionError, setPermissionError] = useState<string>();
  const logout = useSessionStore((state) => state.logout);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      Camera.requestCameraPermissionsAsync(),
      Camera.requestMicrophonePermissionsAsync(),
    ]).then(([camera, microphone]) => {
      if (!mounted) {
        return;
      }
      const granted = camera.granted && microphone.granted;
      setPermissionsGranted(granted);
      if (!granted) {
        setPermissionError('需要相机和麦克风权限才能进行无感购物。');
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

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
  const error = permissionError ?? realtime.error;

  return (
    <ScreenShell dark>
      {permissionsGranted ? (
        <CameraView
          animateShutter={false}
          facing="back"
          mode="picture"
          onCameraReady={() => setCameraReady(true)}
          ref={cameraRef}
          style={styles.hiddenCamera}
        />
      ) : null}

      <View className="absolute -right-28 top-28 h-72 w-72 rounded-full border border-paper/10" />
      <View className="absolute -left-44 top-56 h-96 w-96 rounded-full border border-paper/[0.06]" />

      <View className="flex-1 justify-between px-6 pb-7 pt-5">
        <View className="flex-row items-center justify-between">
          <BrandMark inverse />
          <DevRoleSwitch inverse />
        </View>

        <View className="items-center gap-8">
          <View className="h-56 w-56 items-center justify-center rounded-full border border-paper/15">
            <View
              className={`h-40 w-40 items-center justify-center rounded-full ${
                realtime.status === 'working' ? 'bg-signal' : 'bg-leaf'
              }`}
            >
              <View className="flex-row items-center gap-2">
                {[22, 46, 70, 38, 58].map((height, index) => (
                  <View
                    className="w-[3px] rounded-full bg-paper"
                    key={`${height}-${index}`}
                    style={{ height }}
                  />
                ))}
              </View>
            </View>
          </View>

          <View className="items-center gap-3">
            <Text className="font-medium text-[11px] uppercase tracking-[3px] text-signal">
              {copy.eyebrow}
            </Text>
            <Text className="text-center font-display text-[50px] leading-[52px] text-paper">
              {copy.title}
            </Text>
            <Text className="max-w-[300px] text-center font-sans text-sm leading-6 text-paper/50">
              {error ?? copy.detail}
            </Text>
          </View>

          {realtime.status === 'error' && !permissionError ? (
            <View className="w-full">
              <ActionButton onPress={realtime.reconnect} tone="light">
                重新连接
              </ActionButton>
            </View>
          ) : null}
        </View>

        <View className="flex-row items-end justify-between">
          <View className="gap-1">
            <Text className="font-sans text-[10px] uppercase tracking-[2px] text-paper/35">
              当前顾客
            </Text>
            <Text className="font-display text-2xl text-paper">
              {session.username}
            </Text>
          </View>
          {__DEV__ ? (
            <Pressable
              accessibilityRole="button"
              onPress={logout}
              className="py-2 active:opacity-60"
            >
              <Text className="font-medium text-xs text-paper/45">退出</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  hiddenCamera: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 1,
    height: 1,
    opacity: 0,
  },
});
