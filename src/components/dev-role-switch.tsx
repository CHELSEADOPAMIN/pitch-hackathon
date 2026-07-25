import { Pressable, Text } from 'react-native';

import { useSessionStore } from '@/state/session-store';

export function DevRoleSwitch({
  inverse = false,
  target = '店员',
}: {
  inverse?: boolean;
  target?: '顾客' | '店员';
}) {
  const switchRole = useSessionStore((state) => state.switchRole);

  if (!__DEV__) {
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
        切到{target}端
      </Text>
    </Pressable>
  );
}
