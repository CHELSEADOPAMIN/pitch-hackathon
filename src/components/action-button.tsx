import type { PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';

type ActionButtonProps = PropsWithChildren<{
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  tone?: 'dark' | 'light' | 'signal';
}>;

const toneClasses = {
  dark: 'bg-ink',
  light: 'border border-ink/15 bg-white/60',
  signal: 'bg-signal',
} as const;

const labelClasses = {
  dark: 'text-paper',
  light: 'text-ink',
  signal: 'text-white',
} as const;

export function ActionButton({
  children,
  onPress,
  disabled = false,
  busy = false,
  tone = 'dark',
}: ActionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || busy}
      onPress={onPress}
      className={`h-14 items-center justify-center rounded-full px-6 ${toneClasses[tone]} ${
        disabled || busy
          ? 'opacity-40'
          : 'active:scale-[0.96] active:opacity-90'
      }`}
    >
      {busy ? (
        <ActivityIndicator color={tone === 'light' ? '#141812' : '#F4F0E6'} />
      ) : (
        <Text className={`font-medium text-base ${labelClasses[tone]}`}>
          {children}
        </Text>
      )}
    </Pressable>
  );
}
