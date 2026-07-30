import { Image, Text, View } from 'react-native';

export function BrandMark({ inverse = false }: { inverse?: boolean }) {
  return (
    <View className="flex-row items-center gap-2.5">
      <View
        className={`h-9 w-12 items-center justify-center rounded-xl ${
          inverse ? 'bg-paper/10' : 'bg-ink'
        }`}
      >
        <Image
          resizeMode="contain"
          source={require('../../assets/images/generated/pinch-voice-mark-flat.png')}
          style={{ height: 22, width: 42 }}
        />
      </View>
      <Text
        className={`font-medium text-[12px] uppercase tracking-[2.4px] ${
          inverse ? 'text-paper' : 'text-ink'
        }`}
      >
        Pinch
      </Text>
    </View>
  );
}
