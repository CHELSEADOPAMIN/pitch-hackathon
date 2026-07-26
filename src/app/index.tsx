import { ActivityIndicator, View } from 'react-native';

import { CustomerScreen } from '@/screens/customer-screen';
import { LoginScreen } from '@/screens/login-screen';
import { PaymentSourceScreen } from '@/screens/payment-source-screen';
import { StaffScreen } from '@/screens/staff-screen';
import { useSessionStore } from '@/state/session-store';

export default function HomeScreen() {
  const { hydrated, role, session } = useSessionStore();

  if (!hydrated) {
    return (
      <View className="flex-1 items-center justify-center bg-paper">
        <ActivityIndicator color="#315A43" />
      </View>
    );
  }

  if (role === 'staff') {
    return <StaffScreen />;
  }

  if (!session) {
    return <LoginScreen />;
  }

  if (role === 'customer' && !session.hasPaymentMethod) {
    return <PaymentSourceScreen session={session} />;
  }

  return <CustomerScreen session={session} />;
}
