import type { PropsWithChildren, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { DemoRole } from "@/types/domain";

export function ScreenShell({ children }: PropsWithChildren) {
  return (
    <SafeAreaView className="flex-1 bg-ink">
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View className="absolute -right-28 -top-20 h-72 w-72 rounded-full border border-signal/10 bg-signal/5" />
        <View className="absolute -bottom-32 -left-36 h-80 w-80 rounded-full border border-flare/10 bg-flare/5" />
        {[18, 96, 174, 252, 330, 408, 486, 564, 642, 720].map((top) => (
          <View
            key={top}
            className="absolute left-0 right-0 h-px bg-line/25"
            style={{ top }}
          />
        ))}
      </View>
      {children}
    </SafeAreaView>
  );
}

type BrandHeaderProps = {
  caption: string;
  role?: DemoRole;
  onRoleSwitch?: () => void;
  onLogout?: () => void;
};

export function BrandHeader({
  caption,
  role,
  onRoleSwitch,
  onLogout,
}: BrandHeaderProps) {
  return (
    <View className="flex-row items-center justify-between border-b border-line px-5 py-4">
      <View>
        <Text className="font-mono text-[10px] uppercase tracking-[3px] text-signal">
          PINCH / VOICE
        </Text>
        <Text className="mt-1 font-mono text-[10px] uppercase tracking-[1.5px] text-muted">
          {caption}
        </Text>
      </View>
      <View className="flex-row items-center gap-2">
        {role && onRoleSwitch ? (
          <Pressable
            accessibilityLabel={`Switch to ${role === "customer" ? "staff" : "customer"} view`}
            className="rounded-full border border-line bg-panel px-3 py-2 active:border-signal"
            onPress={onRoleSwitch}
          >
            <Text className="font-mono text-[10px] uppercase tracking-widest text-paper">
              {role === "customer" ? "STAFF ↗" : "SHOP ↗"}
            </Text>
          </Pressable>
        ) : null}
        {onLogout ? (
          <Pressable
            accessibilityLabel="Reset demo session"
            className="h-9 w-9 items-center justify-center rounded-full border border-line active:border-flare"
            onPress={onLogout}
          >
            <Text className="font-mono text-sm text-muted">×</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function Kicker({ children }: PropsWithChildren) {
  return (
    <Text className="font-mono text-[10px] uppercase tracking-[3px] text-signal">
      {children}
    </Text>
  );
}

export function DisplayTitle({ children }: PropsWithChildren) {
  return (
    <Text className="font-display text-[52px] leading-[52px] tracking-[-2px] text-paper">
      {children}
    </Text>
  );
}

export function BodyCopy({
  children,
  muted = false,
}: PropsWithChildren<{ muted?: boolean }>) {
  return (
    <Text
      className={`text-[15px] leading-6 ${muted ? "text-muted" : "text-paper"}`}
    >
      {children}
    </Text>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View className="gap-2">
      <Text className="font-mono text-[10px] uppercase tracking-[2px] text-muted">
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        className="h-14 rounded-2xl border border-line bg-panel px-4 text-base text-paper selection:bg-signal/30 focus:border-signal"
        placeholderTextColor="#65706C"
        {...props}
      />
    </View>
  );
}

type ButtonProps = {
  children: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
};

export function PrimaryButton({
  children,
  disabled,
  loading,
  onPress,
}: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      className="h-14 flex-row items-center justify-between rounded-2xl bg-signal px-5 active:opacity-80 disabled:opacity-40"
      onPress={onPress}
    >
      <Text className="font-mono text-xs font-bold uppercase tracking-[2px] text-ink">
        {loading ? "WORKING" : children}
      </Text>
      {loading ? (
        <ActivityIndicator color="#0A0E0D" />
      ) : (
        <Text className="text-xl text-ink">→</Text>
      )}
    </Pressable>
  );
}

export function ErrorNotice({ message }: { message: string }) {
  return (
    <View
      accessibilityLiveRegion="polite"
      className="rounded-2xl border border-flare/50 bg-flare/10 p-4"
    >
      <Text className="font-mono text-[10px] uppercase tracking-[2px] text-flare">
        SIGNAL LOST
      </Text>
      <Text className="mt-2 text-sm leading-5 text-paper">{message}</Text>
    </View>
  );
}

export function StatusChip({
  active,
  label,
}: {
  active?: boolean;
  label: string;
}) {
  return (
    <View className="flex-row items-center gap-2 rounded-full border border-line bg-panel px-3 py-2">
      <View
        className={`h-2 w-2 rounded-full ${active ? "bg-signal" : "bg-muted"}`}
      />
      <Text className="font-mono text-[9px] uppercase tracking-[2px] text-paper">
        {label}
      </Text>
    </View>
  );
}

export function RuleLabel({
  index,
  children,
}: PropsWithChildren<{ index: string }>) {
  return (
    <View className="flex-row items-center gap-3">
      <Text className="font-mono text-[10px] text-signal">{index}</Text>
      <View className="h-px flex-1 bg-line" />
      <Text className="font-mono text-[10px] uppercase tracking-[2px] text-muted">
        {children}
      </Text>
    </View>
  );
}
