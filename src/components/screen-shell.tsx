import type { PropsWithChildren } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

export function ScreenShell({
  children,
  dark = false,
}: PropsWithChildren<{ dark?: boolean }>) {
  return (
    <SafeAreaView className={`flex-1 ${dark ? 'bg-ink' : 'bg-paper'}`}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      {children}
    </SafeAreaView>
  );
}
