import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { FlatList, Text, TextInput, View } from 'react-native';

import { BrandMark } from '@/components/brand-mark';
import { DevRoleSwitch } from '@/components/dev-role-switch';
import { ScreenShell } from '@/components/screen-shell';
import { type Order, ordersResponseSchema } from '@/contracts/api';
import { api, readJson } from '@/lib/api';

const aud = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
});

function OrderCard({ order }: { order: Order }) {
  return (
    <View className="gap-4 rounded-[28px] border border-ink/10 bg-white/55 p-5">
      <View className="flex-row items-start justify-between">
        <View className="gap-1">
          <Text className="font-display text-3xl text-ink">
            {order.username}
          </Text>
          <Text className="font-sans text-xs text-ink/40">
            {new Date(order.createdAt).toLocaleTimeString('en-AU', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
        <View className="rounded-full bg-leaf px-3 py-2">
          <Text className="font-medium text-[10px] uppercase tracking-[1.5px] text-paper">
            已支付
          </Text>
        </View>
      </View>

      <View className="gap-2 border-y border-ink/10 py-4">
        {order.items.map((item) => (
          <View
            className="flex-row items-center justify-between"
            key={item.productId}
          >
            <Text className="font-sans text-sm text-ink/65">
              {item.name} × {item.qty}
            </Text>
            <Text className="font-medium text-sm text-ink">
              {aud.format((item.priceCents * item.qty) / 100)}
            </Text>
          </View>
        ))}
      </View>

      <View className="flex-row items-end justify-between">
        <Text className="font-sans text-[10px] uppercase tracking-[1.6px] text-ink/35">
          {order.pinchPaymentId}
        </Text>
        <Text className="font-display text-3xl text-ink">
          {aud.format(order.totalCents / 100)}
        </Text>
      </View>
    </View>
  );
}

export function StaffScreen() {
  const [usernameQuery, setUsernameQuery] = useState('');
  const orders = useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const response = await api.api.orders.$get();
      return readJson(response, ordersResponseSchema);
    },
    refetchInterval: 3_000,
  });
  const normalizedQuery = usernameQuery.trim().toLocaleLowerCase();
  const visibleOrders = (orders.data?.orders ?? []).filter((order) =>
    order.username.toLocaleLowerCase().includes(normalizedQuery),
  );

  return (
    <ScreenShell>
      <View className="flex-1 px-6 pt-5">
        <View className="flex-row items-center justify-between">
          <BrandMark />
          <DevRoleSwitch target="顾客" />
        </View>

        <View className="mb-7 mt-11 gap-2">
          <Text className="font-display text-5xl text-ink">今日离店</Text>
          <Text className="font-sans text-sm text-ink/50">
            顾客报出用户名后，按真实支付订单核对。
          </Text>
        </View>

        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setUsernameQuery}
          placeholder="输入用户名查订单"
          placeholderTextColor="#8D8B82"
          value={usernameQuery}
          className="mb-5 h-12 rounded-full border border-ink/15 bg-white/60 px-5 font-sans text-sm text-ink"
        />

        <FlatList
          contentContainerClassName="gap-4 pb-8"
          data={visibleOrders}
          keyExtractor={(order) => order.id}
          onRefresh={orders.refetch}
          refreshing={orders.isRefetching}
          renderItem={({ item }) => <OrderCard order={item} />}
          ListEmptyComponent={
            <View className="mt-14 items-center gap-4">
              <View className="h-16 w-16 rounded-full border border-dashed border-ink/25" />
              <Text className="font-sans text-sm text-ink/40">
                {orders.error instanceof Error
                  ? orders.error.message
                  : normalizedQuery
                    ? '没有匹配的已支付订单'
                    : '等待第一笔已支付订单'}
              </Text>
            </View>
          }
        />
      </View>
    </ScreenShell>
  );
}
