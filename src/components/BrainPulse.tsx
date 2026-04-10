import React, { useEffect, useRef } from "react";
import { View, Animated, Easing } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface BrainPulseProps {
  size?: number;
  color?: string;
  active?: boolean;
}

function PulseRing({
  size,
  color,
  delay,
}: {
  size: number;
  color: string;
  delay: number;
}) {
  const scale = useRef(new Animated.Value(0.4)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1.8,
            duration: 2000,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(opacity, {
              toValue: 0.5,
              duration: 400,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 1600,
              easing: Easing.in(Easing.cubic),
              useNativeDriver: true,
            }),
          ]),
        ]),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 0.4,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [delay, scale, opacity]);

  return (
    <Animated.View
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: color,
        transform: [{ scale }],
        opacity,
      }}
    />
  );
}

export default function BrainPulse({
  size = 80,
  color = "#8B50FB",
  active = true,
}: BrainPulseProps) {
  const iconScale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    if (!active) return;

    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(iconScale, {
          toValue: 1.08,
          duration: 700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(iconScale, {
          toValue: 0.95,
          duration: 700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(glowOpacity, {
          toValue: 0.45,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 0.15,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    breathe.start();
    glow.start();

    return () => {
      breathe.stop();
      glow.stop();
    };
  }, [active, iconScale, glowOpacity]);

  const ringSize = size * 1.6;

  return (
    <View
      style={{
        width: ringSize * 2,
        height: ringSize * 2,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {active && (
        <>
          <PulseRing size={ringSize} color={color} delay={0} />
          <PulseRing size={ringSize} color={color} delay={650} />
          <PulseRing size={ringSize} color={color} delay={1300} />

          {/* Core glow */}
          <Animated.View
            style={{
              position: "absolute",
              width: size * 1.5,
              height: size * 1.5,
              borderRadius: (size * 1.5) / 2,
              backgroundColor: color,
              opacity: glowOpacity,
            }}
          />
        </>
      )}

      <Animated.View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color + "25",
          alignItems: "center",
          justifyContent: "center",
          transform: [{ scale: iconScale }],
        }}
      >
        <Ionicons name="sparkles" size={size * 0.45} color={color} />
      </Animated.View>
    </View>
  );
}
