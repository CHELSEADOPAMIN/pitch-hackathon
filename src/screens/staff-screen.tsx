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
    <View className="gap-4 rounded-[24px] border border-ink/10 bg-white/70 p-5">
      <View className="flex-row items-start justify-between">
        <View className="gap-1">
          <Text className="font-display text-[28px] leading-8 text-ink">
            {order.username}
          </Text>
          <Text className="font-sans text-xs text-ink/40">
            Paid{' '}
            {new Date(order.createdAt).toLocaleTimeString('en-AU', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
        <View className="rounded-full bg-leaf px-3 py-1.5">
          <Text className="font-medium text-xs text-paper">Paid</Text>
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

      <View className="flex-row items-end justify-between gap-5">
        <View className="min-w-0 flex-1 gap-1">
          <Text className="font-medium text-[10px] text-ink/35">
            Payment ID
          </Text>
          <Text className="font-sans text-[10px] text-ink/45" numberOfLines={1}>
            {order.pinchPaymentId}
          </Text>
        </View>
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
  const grossSalesCents = (orders.data?.orders ?? []).reduce(
    (total, order) => total + order.totalCents,
    0,
  );
  const emptyTitle =
    orders.error instanceof Error
      ? 'Orders could not load'
      : normalizedQuery
        ? `No orders for “${usernameQuery.trim()}”`
        : 'No paid orders yet';
  const emptyDetail =
    orders.error instanceof Error
      ? 'Check the connection and pull down to refresh.'
      : normalizedQuery
        ? 'Try another customer name.'
        : 'New orders will appear here automatically.';

  return (
    <ScreenShell>
      <View className="flex-1 px-6 pt-5">
        <View className="flex-row items-center justify-between">
          <BrandMark />
          <DevRoleSwitch target="Shop" />
        </View>

        <View className="mb-6 mt-10 gap-2">
          <Text className="font-medium text-[10px] uppercase tracking-[2px] text-signal">
            Staff
          </Text>
          <Text className="font-display text-[46px] leading-[48px] text-ink">
            Paid orders
          </Text>
          <Text className="font-sans text-sm text-ink/50">
            Check the customer and items before handoff.
          </Text>
        </View>

        <View className="mb-4 flex-row gap-3">
          <View className="flex-1 rounded-[20px] bg-ink p-4">
            <Text className="font-medium text-xs text-paper/55">Orders</Text>
            <Text className="mt-2 font-display text-3xl text-paper">
              {orders.data?.orders.length ?? '—'}
            </Text>
          </View>
          <View className="flex-1 rounded-[20px] bg-oat p-4">
            <Text className="font-medium text-xs text-ink/50">Sales</Text>
            <Text className="mt-2 font-display text-3xl text-ink">
              {orders.data ? aud.format(grossSalesCents / 100) : '—'}
            </Text>
          </View>
        </View>

        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setUsernameQuery}
          placeholder="Search customer"
          placeholderTextColor="#8D8B82"
          value={usernameQuery}
          className="mb-5 h-12 rounded-full border border-ink/15 bg-white/70 px-5 font-sans text-sm text-ink"
        />

        <FlatList
          contentContainerClassName="gap-4 pb-8"
          data={visibleOrders}
          keyExtractor={(order) => order.id}
          onRefresh={orders.refetch}
          refreshing={orders.isRefetching}
          renderItem={({ item }) => <OrderCard order={item} />}
          ListEmptyComponent={
            <View className="mt-12 items-center gap-2 px-6">
              <View className="mb-2 h-10 w-10 items-center justify-center rounded-full bg-oat">
                <View className="h-2.5 w-2.5 rounded-full bg-signal" />
              </View>
              <Text className="font-medium text-base text-ink">
                {emptyTitle}
              </Text>
              <Text className="text-center font-sans text-sm leading-5 text-ink/45">
                {emptyDetail}
              </Text>
            </View>
          }
        />
      </View>
    </ScreenShell>
  );
}
