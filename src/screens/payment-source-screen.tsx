import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  ScrollView,
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
import { getPinchPublishableKey } from '@/lib/runtime-config';
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

  const bindCard = useMutation({
    mutationFn: async () => {
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
            sourceType: 'credit-card',
            cardNumber: cardNumber.replace(/\s/g, ''),
            expiryMonth,
            expiryYear,
            cvc,
            cardHolderName,
          }),
        },
      );

      const rawToken: unknown = await tokenResponse.json();
      if (!tokenResponse.ok) {
        throw new Error(`Pinch 绑卡失败 (${tokenResponse.status})`);
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
    cardNumber.replace(/\s/g, '').length >= 15 &&
    expiryMonth.length === 2 &&
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
                绑定一次，
                {'\n'}之后只用说话。
              </Text>
              <Text className="font-sans text-sm leading-6 text-paper/55">
                卡片信息由你的手机直接发送给 Pinch，不会经过我们的服务器。
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
                label="卡号"
                maxLength={19}
                onChangeText={setCardNumber}
                placeholder="4242 4242 4242 4242"
                value={cardNumber}
              />

              <View className="flex-row gap-5">
                <View className="flex-1">
                  <CardField
                    label="月份"
                    maxLength={2}
                    onChangeText={setExpiryMonth}
                    placeholder="01"
                    value={expiryMonth}
                  />
                </View>
                <View className="flex-1">
                  <CardField
                    label="年份"
                    maxLength={4}
                    onChangeText={setExpiryYear}
                    placeholder="2028"
                    value={expiryYear}
                  />
                </View>
                <View className="flex-1">
                  <CardField
                    label="CVC"
                    maxLength={4}
                    onChangeText={setCvc}
                    placeholder="123"
                    secureTextEntry
                    value={cvc}
                  />
                </View>
              </View>

              <View className="gap-2">
                <Text className="font-medium text-[10px] uppercase tracking-[1.8px] text-paper/45">
                  持卡人
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
              安全绑定
            </ActionButton>
          </View>

          <Text className="font-sans text-xs leading-5 text-paper/35">
            测试环境 · 仅支持 Pinch sandbox 测试卡
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenShell>
  );
}
