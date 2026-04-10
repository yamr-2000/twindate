import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { COLORS } from "../src/constants/theme";

interface StepData {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  color: string;
}

const STEPS: StepData[] = [
  {
    icon: "chatbubbles-outline",
    title: "Upload Your Chats",
    description:
      "Share your chat history from WhatsApp. Our AI analyzes your texting style, humor, and personality traits.",
    color: "#8B50FB",
  },
  {
    icon: "sparkles-outline",
    title: "AI Builds Your Twin",
    description:
      "Our engine creates a digital twin that talks, jokes, and flirts just like you — your personality, replicated.",
    color: "#F5367B",
  },
  {
    icon: "heart-outline",
    title: "Simulate Dates",
    description:
      "Your AI twin goes on simulated dates with other twins. Discover your most compatible matches.",
    color: "#10B981",
  },
];

function LogoGlow() {
  const opacity = useRef(new Animated.Value(0.2)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.2,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={{
        position: "absolute",
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: COLORS.primary,
        opacity,
      }}
    />
  );
}

export default function WelcomeScreen() {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % STEPS.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-dark-800">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with glow */}
        <View className="items-center pt-14 pb-6">
          <View className="items-center justify-center mb-5">
            <LogoGlow />
            <View
              className="w-20 h-20 rounded-3xl items-center justify-center"
              style={{
                backgroundColor: COLORS.primary,
                shadowColor: COLORS.primary,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.5,
                shadowRadius: 20,
                elevation: 16,
              }}
            >
              <Ionicons name="heart-half-outline" size={40} color="#FFFFFF" />
            </View>
          </View>
          <Text className="text-4xl font-bold text-white tracking-tight">
            TwinDate
          </Text>
          <Text className="text-base text-dark-200 mt-2 tracking-wide">
            AI-Powered Dating Simulation
          </Text>
        </View>

        {/* Tagline */}
        <View className="mx-6 mt-4 mb-8 rounded-2xl bg-dark-700 border border-primary-500/20 p-6">
          <Text className="text-center text-lg text-white leading-7">
            Let your{" "}
            <Text className="text-primary-400 font-semibold">AI twin</Text>{" "}
            find your perfect match — before you even say hello.
          </Text>
        </View>

        {/* Steps */}
        <View className="mx-6">
          <Text className="text-sm font-semibold text-dark-200 uppercase tracking-widest mb-4 ml-1">
            How It Works
          </Text>

          {STEPS.map((step, index) => {
            const isActive = index === activeStep;
            return (
              <TouchableOpacity
                key={index}
                activeOpacity={0.8}
                onPress={() => setActiveStep(index)}
                className={`flex-row rounded-2xl p-4 mb-3 border ${
                  isActive
                    ? "border-primary-500/30"
                    : "bg-dark-700 border-dark-500"
                }`}
                style={
                  isActive
                    ? { backgroundColor: step.color + "10" }
                    : undefined
                }
              >
                <View
                  className="w-14 h-14 rounded-xl items-center justify-center mr-4"
                  style={{
                    backgroundColor: isActive ? step.color : COLORS.darkCard,
                  }}
                >
                  <Ionicons
                    name={step.icon}
                    size={26}
                    color={isActive ? "#FFFFFF" : COLORS.textSecondary}
                  />
                </View>

                <View className="flex-1">
                  <View className="flex-row items-center mb-1">
                    <Text
                      className="text-xs font-bold mr-2"
                      style={{ color: isActive ? step.color : COLORS.textMuted }}
                    >
                      STEP {index + 1}
                    </Text>
                  </View>
                  <Text className="text-base font-semibold text-white mb-1">
                    {step.title}
                  </Text>
                  {isActive && (
                    <Text className="text-sm text-dark-200 leading-5 mt-1">
                      {step.description}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Trust Badges */}
        <View className="flex-row justify-center mx-6 mt-6 mb-4 gap-8">
          {[
            { icon: "shield-checkmark-outline" as const, label: "Anonymized" },
            { icon: "eye-off-outline" as const, label: "Private" },
            { icon: "trash-outline" as const, label: "Deletable" },
          ].map((badge) => (
            <View key={badge.label} className="items-center">
              <View className="w-10 h-10 rounded-full bg-dark-700 border border-dark-500 items-center justify-center mb-1">
                <Ionicons
                  name={badge.icon}
                  size={18}
                  color={COLORS.textSecondary}
                />
              </View>
              <Text className="text-xs text-dark-300">{badge.label}</Text>
            </View>
          ))}
        </View>

        {/* CTA */}
        <View className="mx-6 mt-4 mb-8">
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.replace("/onboarding")}
            className="bg-primary-500 rounded-2xl py-4 items-center"
            style={{
              shadowColor: COLORS.primary,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.5,
              shadowRadius: 16,
              elevation: 12,
            }}
          >
            <View className="flex-row items-center">
              <Text className="text-white text-lg font-bold mr-2">
                Get Started
              </Text>
              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          <Text className="text-center text-xs text-dark-300 mt-4">
            Your data is anonymized and never stored remotely.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
