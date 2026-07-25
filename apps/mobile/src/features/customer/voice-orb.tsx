import { useEffect, useState } from "react";
import { Animated, Text, View } from "react-native";

import type { VoicePhase } from "@/types/domain";

const PHASE_COPY: Record<
  VoicePhase,
  { eyebrow: string; title: string; color: string }
> = {
  idle: { eyebrow: "STANDBY", title: "Warming up", color: "#8C9A95" },
  "requesting-permissions": {
    eyebrow: "ACCESS",
    title: "Asking permission",
    color: "#FF9C66",
  },
  connecting: {
    eyebrow: "LINKING",
    title: "Opening voice line",
    color: "#68F5A5",
  },
  listening: { eyebrow: "MIC LIVE", title: "I’m listening", color: "#68F5A5" },
  speaking: {
    eyebrow: "VOICE OUT",
    title: "Pinch is speaking",
    color: "#F4F0E5",
  },
  capturing: {
    eyebrow: "CAMERA",
    title: "Looking at the item",
    color: "#FF9C66",
  },
  thinking: { eyebrow: "AGENT", title: "Matching the shelf", color: "#68F5A5" },
  charging: {
    eyebrow: "PINCH PAY",
    title: "Confirming payment",
    color: "#FF9C66",
  },
  reconnecting: {
    eyebrow: "RETRY",
    title: "Finding the line",
    color: "#68F5A5",
  },
  error: { eyebrow: "OFFLINE", title: "Connection paused", color: "#FF9C66" },
};

export function VoiceOrb({ phase }: { phase: VoicePhase }) {
  const [pulse] = useState(() => new Animated.Value(0));
  const copy = PHASE_COPY[phase];

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          duration: 1_100,
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          duration: 1_100,
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  return (
    <View className="h-72 items-center justify-center">
      <Animated.View
        className="absolute h-56 w-56 rounded-full border"
        style={{
          borderColor: copy.color,
          opacity: pulse.interpolate({
            inputRange: [0, 1],
            outputRange: [0.08, 0.28],
          }),
          transform: [
            {
              scale: pulse.interpolate({
                inputRange: [0, 1],
                outputRange: [0.88, 1.08],
              }),
            },
          ],
        }}
      />
      <View
        className="h-44 w-44 items-center justify-center rounded-full border bg-panel"
        style={{ borderColor: copy.color }}
      >
        <View className="mb-4 flex-row items-end gap-1">
          {[14, 28, 40, 22, 32, 17].map((height, index) => (
            <View
              key={`${height}-${index}`}
              className="w-1 rounded-full"
              style={{
                backgroundColor: copy.color,
                height: phase === "listening" ? height : height / 2,
              }}
            />
          ))}
        </View>
        <Text
          className="font-mono text-[9px] uppercase tracking-[3px]"
          style={{ color: copy.color }}
        >
          {copy.eyebrow}
        </Text>
        <Text className="mt-2 text-center font-display text-xl text-paper">
          {copy.title}
        </Text>
      </View>
    </View>
  );
}
