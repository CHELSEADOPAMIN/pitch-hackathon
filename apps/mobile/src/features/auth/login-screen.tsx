import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";

import {
  BodyCopy,
  DisplayTitle,
  ErrorNotice,
  Field,
  Kicker,
  PrimaryButton,
  RuleLabel,
  ScreenShell,
} from "@/components/ui/demo-ui";
import { login } from "@/lib/api-client";
import { useSessionStore } from "@/store/session-store";

export function LoginScreen() {
  const [username, setUsername] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const completeLogin = useSessionStore((state) => state.completeLogin);
  const mutation = useMutation({
    mutationFn: login,
    onSuccess: ({ user, hasPaymentMethod }) =>
      completeLogin(user, hasPaymentMethod),
  });

  function submit() {
    const normalized = username.trim();
    if (normalized.length < 2 || normalized.length > 24) {
      setValidationError("Use a username between 2 and 24 characters.");
      return;
    }
    setValidationError(null);
    mutation.mutate(normalized);
  }

  const message =
    validationError ??
    (mutation.error instanceof Error ? mutation.error.message : null);

  return (
    <ScreenShell>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerClassName="flex-grow px-5 pb-8 pt-10"
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-auto">
            <Kicker>STORE SESSION / 001</Kicker>
            <View className="mt-8 max-w-[350px]">
              <DisplayTitle>
                Say it.{`\n`}Pay once.{`\n`}Walk out.
              </DisplayTitle>
            </View>
            <View className="mt-7 max-w-[330px]">
              <BodyCopy muted>
                No scanner. No checkout queue. Your voice and the camera do the
                small talk.
              </BodyCopy>
            </View>
          </View>

          <View className="mt-14 gap-5 rounded-[28px] border border-line bg-ink/80 p-5">
            <RuleLabel index="01">IDENTIFY</RuleLabel>
            <Field
              autoCapitalize="none"
              autoCorrect={false}
              enterKeyHint="go"
              label="Your exit name"
              maxLength={24}
              onChangeText={setUsername}
              onSubmitEditing={submit}
              placeholder="e.g. river"
              returnKeyType="go"
              value={username}
            />
            {message ? <ErrorNotice message={message} /> : null}
            <PrimaryButton loading={mutation.isPending} onPress={submit}>
              ENTER STORE
            </PrimaryButton>
            <Text className="text-center font-mono text-[9px] uppercase tracking-[1.5px] text-muted">
              DEMO LOGIN · NO PASSWORD · TEST PAYMENTS ONLY
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenShell>
  );
}
