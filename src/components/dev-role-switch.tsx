import { Pressable, Text } from 'react-native';

import { demoControlsEnabled } from '@/lib/runtime-config';
import { useSessionStore } from '@/state/session-store';

export function DevRoleSwitch({
  inverse = false,
  target = 'Merchant',
}: {
  inverse?: boolean;
  target?: 'Shopper' | 'Merchant';
}) {
  const switchRole = useSessionStore((state) => state.switchRole);

  if (!demoControlsEnabled()) {
    return null;
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={switchRole}
      className={`rounded-full border px-4 py-2 active:opacity-60 ${
        inverse ? 'border-paper/30' : 'border-ink/20'
      }`}
    >
      <Text
        className={`font-medium text-xs ${inverse ? 'text-paper' : 'text-ink'}`}
      >
        {target} view
      </Text>
    </Pressable>
  );
}
