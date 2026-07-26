import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { z } from 'zod';

import { ActionButton } from '@/components/action-button';
import { BrandMark } from '@/components/brand-mark';
import { DevRoleSwitch } from '@/components/dev-role-switch';
import { ScreenShell } from '@/components/screen-shell';
import {
  type LoginResponse,
  paymentSourceResponseSchema,
} from '@/contracts/api';
import { api, readJson } from '@/lib/api';
import { formatCardNumber, prepareCardDetails } from '@/lib/card-details';
import {
  demoControlsEnabled,
  getPinchPublishableKey,
} from '@/lib/runtime-config';
import { useSessionStore } from '@/state/session-store';

const tokenResponseSchema = z.object({
  token: z.string().startsWith('tkn_'),
});

type CardFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  maxLength?: number;
};

function CardField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  maxLength,
}: CardFieldProps) {
  return (
    <View className="gap-2">
      <Text className="font-medium text-[10px] uppercase tracking-[1.8px] text-paper/45">
        {label}
      </Text>
      <TextInput
        keyboardType="number-pad"
        maxLength={maxLength}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#7F817A"
        secureTextEntry={secureTextEntry}
        value={value}
        className="h-14 border-b border-paper/20 font-sans text-lg text-paper"
      />
    </View>
  );
}

export function PaymentSourceScreen({ session }: { session: LoginResponse }) {
  const [cardNumber, setCardNumber] = useState('');
  const [expiryMonth, setExpiryMonth] = useState('');
  const [expiryYear, setExpiryYear] = useState('');
  const [cvc, setCvc] = useState('');
  const [cardHolderName, setCardHolderName] = useState(session.username);
  const setPaymentMethodBound = useSessionStore(
    (state) => state.setPaymentMethodBound,
  );
  const logout = useSessionStore((state) => state.logout);

  const bindCard = useMutation({
    mutationFn: async () => {
      const prepared = prepareCardDetails({
        cardNumber,
        expiryMonth,
        expiryYear,
        cvc,
        cardHolderName,
      });
      if (!prepared.ok) {
        throw new Error(prepared.message);
      }

      const tokenResponse = await fetch(
        'https://api.getpinch.com.au/test/tokens',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'pinch-version': '2020.1',
          },
          body: JSON.stringify({
            publishableKey: getPinchPublishableKey(),
            ...prepared.value,
          }),
        },
      );

      const rawToken: unknown = await readResponseBody(tokenResponse);
      if (!tokenResponse.ok) {
        throw new Error(pinchCardError(rawToken, tokenResponse.status));
      }
      const { token } = tokenResponseSchema.parse(rawToken);

      const response = await api.api['payment-source'].$post({
        json: { userId: session.userId, token },
      });
      return readJson(response, paymentSourceResponseSchema);
    },
    onSuccess: () => {
      setCardNumber('');
      setExpiryMonth('');
      setExpiryYear('');
      setCvc('');
      setPaymentMethodBound();
    },
  });

  const complete =
    cardNumber.replace(/\D/g, '').length >= 13 &&
    expiryMonth.length >= 1 &&
    expiryYear.length === 4 &&
    cvc.length >= 3 &&
    cardHolderName.trim().length > 0;

  const message =
    bindCard.error instanceof Error ? bindCard.error.message : undefined;

  return (
    <ScreenShell dark>
      <KeyboardAvoidingView className="flex-1">
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="flex-grow justify-between px-6 pb-7 pt-5"
        >
          <View className="flex-row items-center justify-between">
            <BrandMark inverse />
            <DevRoleSwitch inverse />
          </View>

          <View className="my-10 gap-8">
            <View className="gap-3">
              <Text className="font-display text-[52px] leading-[50px] text-paper">
                Save once.
                {'\n'}Then just talk.
              </Text>
              <Text className="font-sans text-sm leading-6 text-paper/55">
                Card details go directly from this phone to Pinch. They never
                pass through our server.
              </Text>
            </View>

            <View className="gap-6 rounded-[28px] border border-paper/15 bg-paper/[0.04] p-6">
              <View className="flex-row items-center justify-between">
                <Text className="font-medium text-xs uppercase tracking-[2px] text-paper/50">
                  Sandbox card
                </Text>
                <View className="h-3 w-7 rounded-full bg-signal" />
              </View>

              <CardField
                label="Card number"
                maxLength={23}
                onChangeText={(value) => setCardNumber(formatCardNumber(value))}
                placeholder="4242 4242 4242 4242"
                value={cardNumber}
              />

              <View className="flex-row gap-5">
                <View className="flex-1">
                  <CardField
                    label="Month"
                    maxLength={2}
                    onChangeText={(value) =>
                      setExpiryMonth(value.replace(/\D/g, ''))
                    }
                    placeholder="01"
                    value={expiryMonth}
                  />
                </View>
                <View className="flex-1">
                  <CardField
                    label="Year"
                    maxLength={4}
                    onChangeText={(value) =>
                      setExpiryYear(value.replace(/\D/g, ''))
                    }
                    placeholder="2028"
                    value={expiryYear}
                  />
                </View>
                <View className="flex-1">
                  <CardField
                    label="CVC"
                    maxLength={4}
                    onChangeText={(value) => setCvc(value.replace(/\D/g, ''))}
                    placeholder="123"
                    secureTextEntry
                    value={cvc}
                  />
                </View>
              </View>

              <View className="gap-2">
                <Text className="font-medium text-[10px] uppercase tracking-[1.8px] text-paper/45">
                  Name on card
                </Text>
                <TextInput
                  onChangeText={setCardHolderName}
                  value={cardHolderName}
                  className="h-14 border-b border-paper/20 font-sans text-lg text-paper"
                />
              </View>
            </View>

            {message ? (
              <Text className="font-sans text-sm text-signal">{message}</Text>
            ) : null}

            <ActionButton
              busy={bindCard.isPending}
              disabled={!complete}
              onPress={() => bindCard.mutate()}
              tone="signal"
            >
              Save test card
            </ActionButton>
          </View>

          <View className="flex-row items-center justify-between">
            <Text className="font-sans text-xs leading-5 text-paper/35">
              Test environment · Pinch sandbox cards only
            </Text>
            {demoControlsEnabled() ? (
              <Pressable
                accessibilityRole="button"
                onPress={logout}
                className="py-2 active:opacity-60"
              >
                <Text className="font-medium text-xs text-paper/50">
                  Sign out
                </Text>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenShell>
  );
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function pinchCardError(payload: unknown, status: number) {
  const detail = publicPinchMessage(payload);
  return detail
    ? `Pinch could not save this card: ${detail}`
    : `Pinch could not save this card (${status}).`;
}

function publicPinchMessage(payload: unknown): string | undefined {
  const candidate =
    typeof payload === 'string'
      ? payload
      : payload && typeof payload === 'object'
        ? ['message', 'error_description', 'error'].flatMap((key) => {
            const value = (payload as Record<string, unknown>)[key];
            return typeof value === 'string' ? [value] : [];
          })[0]
        : undefined;

  if (!candidate) return undefined;
  return candidate
    .replace(/\b(?:tkn|pk|sk|app)_[A-Za-z0-9_-]+\b/g, '[redacted]')
    .replace(/\b\d{12,19}\b/g, '[redacted]')
    .slice(0, 180);
}
