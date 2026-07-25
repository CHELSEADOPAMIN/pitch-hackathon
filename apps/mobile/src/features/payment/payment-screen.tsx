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
  BrandHeader,
  DisplayTitle,
  ErrorNotice,
  Field,
  Kicker,
  PrimaryButton,
  RuleLabel,
  ScreenShell,
} from "@/components/ui/demo-ui";
import { ApiError, attachPaymentSource, tokenizeCard } from "@/lib/api-client";
import { prepareCardDetails, type CardDraft } from "@/lib/card-details";
import { useSessionStore } from "@/store/session-store";

const EMPTY_CARD: CardDraft = {
  cardHolderName: "",
  cardNumber: "",
  expiryMonth: "",
  expiryYear: "",
  cvc: "",
};

function formatCardNumber(value: string) {
  return value
    .replace(/\D/g, "")
    .slice(0, 19)
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

export function PaymentScreen() {
  const [card, setCard] = useState<CardDraft>(EMPTY_CARD);
  const user = useSessionStore((state) => state.user);
  const markPaymentAttached = useSessionStore(
    (state) => state.markPaymentAttached,
  );
  const logout = useSessionStore((state) => state.logout);
  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new ApiError("Start a demo session first.");
      const prepared = prepareCardDetails(card);
      if (!prepared.ok) throw new ApiError(prepared.message);

      const token = await tokenizeCard(prepared.value);
      await attachPaymentSource(user.id, token);
    },
    onSuccess: () => {
      setCard(EMPTY_CARD);
      markPaymentAttached();
    },
  });

  function update(field: keyof CardDraft, value: string) {
    setCard((current) => ({ ...current, [field]: value }));
  }

  return (
    <ScreenShell>
      <BrandHeader caption="PAYMENT VAULT / TEST" onLogout={logout} />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerClassName="px-5 pb-12 pt-8"
          keyboardShouldPersistTaps="handled"
        >
          <Kicker>ONE-TIME SETUP</Kicker>
          <View className="mt-5">
            <DisplayTitle>Tap once.{`\n`}Then just talk.</DisplayTitle>
          </View>
          <View className="mt-5 max-w-[350px]">
            <BodyCopy muted>
              Save a test card now. Checkout stays inside the voice conversation
              after this.
            </BodyCopy>
          </View>

          <View className="mt-8 rounded-[28px] border border-line bg-panel/80 p-5">
            <View className="flex-row items-start justify-between">
              <View>
                <Text className="font-mono text-[10px] uppercase tracking-[2px] text-muted">
                  PINCH TEST VAULT
                </Text>
                <Text className="mt-3 font-display text-3xl text-paper">
                  •••• 4242
                </Text>
              </View>
              <View className="rounded-full border border-signal/40 bg-signal/10 px-3 py-2">
                <Text className="font-mono text-[9px] uppercase tracking-widest text-signal">
                  TEST
                </Text>
              </View>
            </View>
            <View className="mt-8 gap-4">
              <RuleLabel index="02">TOKENIZE</RuleLabel>
              <Field
                autoComplete="cc-name"
                label="Name on card"
                onChangeText={(value) => update("cardHolderName", value)}
                placeholder="Demo Shopper"
                value={card.cardHolderName}
              />
              <Field
                autoComplete="cc-number"
                keyboardType="number-pad"
                label="Test card number"
                maxLength={23}
                onChangeText={(value) =>
                  update("cardNumber", formatCardNumber(value))
                }
                placeholder="4242 4242 4242 4242"
                value={card.cardNumber}
              />
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Field
                    keyboardType="number-pad"
                    label="Month"
                    maxLength={2}
                    onChangeText={(value) =>
                      update("expiryMonth", value.replace(/\D/g, ""))
                    }
                    placeholder="01"
                    value={card.expiryMonth}
                  />
                </View>
                <View className="flex-1">
                  <Field
                    keyboardType="number-pad"
                    label="Year"
                    maxLength={4}
                    onChangeText={(value) =>
                      update("expiryYear", value.replace(/\D/g, ""))
                    }
                    placeholder="2030"
                    value={card.expiryYear}
                  />
                </View>
                <View className="flex-1">
                  <Field
                    keyboardType="number-pad"
                    label="CVC"
                    maxLength={4}
                    onChangeText={(value) =>
                      update("cvc", value.replace(/\D/g, ""))
                    }
                    placeholder="123"
                    secureTextEntry
                    value={card.cvc}
                  />
                </View>
              </View>
              {mutation.error instanceof Error ? (
                <ErrorNotice message={mutation.error.message} />
              ) : null}
              <PrimaryButton
                loading={mutation.isPending}
                onPress={() => mutation.mutate()}
              >
                SAVE TEST CARD
              </PrimaryButton>
            </View>
          </View>

          <View className="mt-5 flex-row gap-3 rounded-2xl border border-signal/20 bg-signal/5 p-4">
            <Text className="font-mono text-signal">↗</Text>
            <Text className="flex-1 text-xs leading-5 text-muted">
              Card details go directly from this device to Pinch. This app never
              sends them to the demo server or saves them on-device.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenShell>
  );
}
