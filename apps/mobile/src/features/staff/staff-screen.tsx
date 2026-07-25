import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";

import {
  BrandHeader,
  ErrorNotice,
  Field,
  RuleLabel,
  ScreenShell,
  StatusChip,
} from "@/components/ui/demo-ui";
import { getOrders } from "@/lib/api-client";
import { useSessionStore } from "@/store/session-store";
import type { Order } from "@/types/domain";

function money(cents: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(cents / 100);
}

function OrderCard({ order }: { order: Order }) {
  const itemCount = order.items.reduce((sum, item) => sum + item.qty, 0);
  return (
    <View className="overflow-hidden rounded-[26px] border border-line bg-panel/85">
      <View className="flex-row items-start justify-between border-b border-line p-5">
        <View className="flex-1">
          <Text className="font-mono text-[9px] uppercase tracking-[2px] text-signal">
            {order.status} ·{" "}
            {new Date(order.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
          <Text className="mt-2 font-display text-[32px] text-paper">
            {order.username}
          </Text>
        </View>
        <Text className="font-mono text-sm text-paper">
          {money(order.totalCents)}
        </Text>
      </View>
      <View className="gap-3 px-5 py-4">
        {order.items.map((item) => (
          <View
            className="flex-row items-center"
            key={`${order.id}-${item.productId}`}
          >
            <Text className="w-8 font-mono text-[10px] text-muted">
              {item.qty}×
            </Text>
            <Text className="flex-1 text-sm text-paper">{item.name}</Text>
            <Text className="font-mono text-[10px] text-muted">
              {money(item.priceCents * item.qty)}
            </Text>
          </View>
        ))}
      </View>
      <View className="flex-row items-center justify-between bg-signal px-5 py-3">
        <Text className="font-mono text-[9px] font-bold uppercase tracking-[2px] text-ink">
          PAYMENT VERIFIED
        </Text>
        <Text className="font-mono text-[9px] text-ink">
          {itemCount} ITEM{itemCount === 1 ? "" : "S"} →
        </Text>
      </View>
    </View>
  );
}

export function StaffScreen() {
  const [filter, setFilter] = useState("");
  const role = useSessionStore((state) => state.role);
  const toggleRole = useSessionStore((state) => state.toggleRole);
  const logout = useSessionStore((state) => state.logout);
  const ordersQuery = useQuery({
    queryKey: ["staff-orders"],
    queryFn: () => getOrders(),
    refetchInterval: 3_000,
  });
  const orders = useMemo(() => {
    const normalized = filter.trim().toLocaleLowerCase();
    if (!normalized) return ordersQuery.data ?? [];
    return (ordersQuery.data ?? []).filter((order) =>
      order.username.toLocaleLowerCase().includes(normalized),
    );
  }, [filter, ordersQuery.data]);

  return (
    <ScreenShell>
      <BrandHeader
        caption="STAFF GATE / LIVE"
        onLogout={logout}
        role={role}
        onRoleSwitch={toggleRole}
      />
      <ScrollView
        contentContainerClassName="px-5 pb-12 pt-6"
        refreshControl={
          <RefreshControl
            colors={["#68F5A5"]}
            onRefresh={() => void ordersQuery.refetch()}
            refreshing={ordersQuery.isRefetching}
            tintColor="#68F5A5"
          />
        }
      >
        <View className="flex-row items-end justify-between">
          <View>
            <Text className="font-mono text-[10px] uppercase tracking-[3px] text-signal">
              EXIT DESK
            </Text>
            <Text className="mt-3 font-display text-[44px] leading-[46px] text-paper">
              Paid orders.
            </Text>
          </View>
          <StatusChip active={ordersQuery.isSuccess} label="3S LIVE" />
        </View>

        <View className="mt-8">
          <Field
            autoCapitalize="none"
            autoCorrect={false}
            label="Find by exit name"
            onChangeText={setFilter}
            placeholder="Type a username"
            value={filter}
          />
        </View>

        <View className="mt-7">
          <RuleLabel index={String(orders.length).padStart(2, "0")}>
            VISIBLE ORDERS
          </RuleLabel>
        </View>

        {ordersQuery.error instanceof Error ? (
          <View className="mt-5">
            <ErrorNotice message={ordersQuery.error.message} />
          </View>
        ) : null}

        <View className="mt-5 gap-4">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
          {ordersQuery.isSuccess && orders.length === 0 ? (
            <View className="items-center rounded-[26px] border border-dashed border-line px-6 py-14">
              <Text className="font-display text-2xl text-paper">
                No matching orders.
              </Text>
              <Text className="mt-2 text-center text-sm text-muted">
                New approved payments appear here within one polling cycle.
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </ScreenShell>
  );
}
