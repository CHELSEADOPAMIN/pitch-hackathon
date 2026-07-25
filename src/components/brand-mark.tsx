import { Text, View } from 'react-native';

export function BrandMark({ inverse = false }: { inverse?: boolean }) {
  return (
    <View className="flex-row items-center gap-3">
      <View
        className={`h-9 w-9 items-center justify-center rounded-full ${
          inverse ? 'bg-paper' : 'bg-ink'
        }`}
      >
        <View
          className={`h-3 w-3 rounded-full ${
            inverse ? 'bg-signal' : 'bg-paper'
          }`}
        />
      </View>
      <Text
        className={`font-medium text-[12px] uppercase tracking-[3px] ${
          inverse ? 'text-paper' : 'text-ink'
        }`}
      >
        Pinch Voice
      </Text>
    </View>
  );
}
