import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { KeyboardAvoidingView, Text, TextInput, View } from 'react-native';

import { ActionButton } from '@/components/action-button';
import { BrandMark } from '@/components/brand-mark';
import { ScreenShell } from '@/components/screen-shell';
import { loginRequestSchema, loginResponseSchema } from '@/contracts/api';
import { api, readJson } from '@/lib/api';
import { demoControlsEnabled } from '@/lib/runtime-config';
import { useSessionStore } from '@/state/session-store';

export function LoginScreen() {
  const [username, setUsername] = useState('');
  const setSession = useSessionStore((state) => state.setSession);
  const setRole = useSessionStore((state) => state.setRole);

  const login = useMutation({
    mutationFn: async () => {
      const input = loginRequestSchema.parse({ username });
      const response = await api.api.login.$post({ json: input });
      return readJson(response, loginResponseSchema);
    },
    onSuccess: setSession,
  });

  const message =
    login.error instanceof Error ? login.error.message : undefined;

  return (
    <ScreenShell>
      <View className="absolute -right-24 top-24 h-64 w-64 rounded-full border border-oat" />
      <View className="absolute -left-20 bottom-10 h-44 w-44 rounded-full bg-oat/50" />

      <KeyboardAvoidingView className="flex-1 justify-between px-6 pb-7 pt-5">
        <BrandMark />

        <View className="gap-7">
          <View className="gap-3">
            <Text className="font-display text-[58px] leading-[55px] text-ink">
              See it.
              {'\n'}Say it. Shop.
            </Text>
            <Text className="max-w-[310px] font-sans text-base leading-6 text-ink/60">
              Tell us your name first. A merchant can use it to find your paid
              order when you leave.
            </Text>
          </View>

          <View className="gap-3">
            <Text className="ml-5 font-medium text-[11px] uppercase tracking-[2px] text-ink/45">
              Your name
            </Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={40}
              onChangeText={setUsername}
              onSubmitEditing={() => login.mutate()}
              placeholder="For example, Chelsea"
              placeholderTextColor="#8D8B82"
              returnKeyType="go"
              value={username}
              className="h-16 rounded-full border border-ink/15 bg-white/60 px-6 font-sans text-lg text-ink"
            />
            {message ? (
              <Text className="ml-5 font-sans text-sm text-signal">
                {message}
              </Text>
            ) : null}
          </View>

          <View className="gap-3">
            <ActionButton
              busy={login.isPending}
              disabled={username.trim().length < 2}
              onPress={() => login.mutate()}
            >
              Enter the store
            </ActionButton>
            {demoControlsEnabled() ? (
              <ActionButton onPress={() => setRole('staff')} tone="light">
                Open merchant dashboard
              </ActionButton>
            ) : null}
          </View>
        </View>

        <View className="self-start">
          <Text className="font-sans text-xs leading-5 text-ink/40">
            Hackathon demo · No password required
          </Text>
        </View>
      </KeyboardAvoidingView>
    </ScreenShell>
  );
}
