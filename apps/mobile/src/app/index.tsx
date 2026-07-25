import { ActivityIndicator, Text, View } from "react-native";

import { ScreenShell } from "@/components/ui/demo-ui";
import { LoginScreen } from "@/features/auth/login-screen";
import { CustomerScreen } from "@/features/customer/customer-screen";
import { PaymentScreen } from "@/features/payment/payment-screen";
import { StaffScreen } from "@/features/staff/staff-screen";
import { useStoreHydrated } from "@/hooks/use-store-hydrated";
import { useSessionStore } from "@/store/session-store";

export default function HomeScreen() {
  const hydrated = useStoreHydrated();
  const user = useSessionStore((state) => state.user);
  const hasPaymentMethod = useSessionStore((state) => state.hasPaymentMethod);
  const role = useSessionStore((state) => state.role);

  if (!hydrated) {
    return (
      <ScreenShell>
        <View className="flex-1 items-center justify-center gap-4">
          <ActivityIndicator color="#68F5A5" />
          <Text className="font-mono text-[10px] uppercase tracking-[3px] text-muted">
            RESTORING SESSION
          </Text>
        </View>
      </ScreenShell>
    );
  }
  if (!user) return <LoginScreen />;
  if (!hasPaymentMethod) return <PaymentScreen />;
  return role === "staff" ? <StaffScreen /> : <CustomerScreen />;
}
