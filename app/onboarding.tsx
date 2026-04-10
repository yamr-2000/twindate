import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { COLORS } from "../src/constants/theme";
import { savePreferences } from "../src/storage/preferences";
import { supabase } from "../src/lib/supabase";
import type { Gender, InterestedIn } from "../src/types/chat";

type Step = "age" | "gender" | "interested";

interface OptionCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sublabel?: string;
  selected: boolean;
  color: string;
  onPress: () => void;
}

function OptionCard({ icon, label, sublabel, selected, color, onPress }: OptionCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      className={`rounded-2xl p-5 mb-3 border ${
        selected ? "border-primary-500/50" : "border-dark-500"
      }`}
      style={{
        backgroundColor: selected ? color + "15" : COLORS.darkCard,
      }}
    >
      <View className="flex-row items-center">
        <View
          className="w-14 h-14 rounded-xl items-center justify-center mr-4"
          style={{ backgroundColor: selected ? color + "30" : COLORS.border + "40" }}
        >
          <Ionicons name={icon} size={28} color={selected ? color : COLORS.textMuted} />
        </View>
        <View className="flex-1">
          <Text className="text-lg font-semibold text-white">{label}</Text>
          {sublabel && (
            <Text className="text-sm text-dark-200 mt-0.5">{sublabel}</Text>
          )}
        </View>
        {selected && (
          <View className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: color }}>
            <Ionicons name="checkmark" size={18} color="#FFFFFF" />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("age");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [interestedIn, setInterestedIn] = useState<InterestedIn | null>(null);

  const handleNext = () => {
    if (step === "age") {
      const numAge = parseInt(age, 10);
      if (!numAge || numAge < 18 || numAge > 100) {
        Alert.alert("Invalid Age", "Please enter a valid age (18+).");
        return;
      }
      setStep("gender");
    } else if (step === "gender") {
      if (!gender) {
        Alert.alert("Select Gender", "Please select your gender.");
        return;
      }
      setStep("interested");
    }
  };

  const handleFinish = async () => {
    if (!interestedIn) {
      Alert.alert("Select Preference", "Please select who you are interested in.");
      return;
    }

    const numAge = parseInt(age, 10);
    const prefs = { age: numAge, gender: gender!, interestedIn };

    await savePreferences(prefs);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase.from("profiles").upsert({
          id: user.id,
          display_name: user.email?.split("@")[0] ?? "User",
          age: numAge,
          gender: gender!,
          interested_in: interestedIn,
        });
        if (error) console.warn("Profile sync failed:", error.message);
      }
    } catch (e) {
      console.warn("Could not sync profile to cloud:", e);
    }

    router.replace("/(tabs)");
  };

  const canProceed =
    (step === "age" && age.length > 0) ||
    (step === "gender" && gender !== null) ||
    (step === "interested" && interestedIn !== null);

  const stepIndex = step === "age" ? 0 : step === "gender" ? 1 : 2;

  return (
    <SafeAreaView className="flex-1 bg-dark-800">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="px-6 pt-8 pb-2">
          <View className="flex-row items-center mb-6">
            {step !== "age" && (
              <TouchableOpacity
                onPress={() => setStep(step === "interested" ? "gender" : "age")}
                className="w-10 h-10 rounded-full bg-dark-700 items-center justify-center mr-3"
              >
                <Ionicons name="arrow-back" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            )}
            <View className="flex-1" />
            <Text className="text-sm text-dark-300">{stepIndex + 1} of 3</Text>
          </View>

          {/* Progress dots */}
          <View className="flex-row justify-center mb-8 gap-2">
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                className="h-1.5 rounded-full"
                style={{
                  width: i === stepIndex ? 32 : 12,
                  backgroundColor: i <= stepIndex ? COLORS.primary : COLORS.border,
                }}
              />
            ))}
          </View>
        </View>

        {/* ─── AGE STEP ─── */}
        {step === "age" && (
          <View className="px-6">
            <View className="items-center mb-8">
              <View className="w-16 h-16 rounded-full bg-primary-500/20 items-center justify-center mb-4">
                <Ionicons name="calendar-outline" size={32} color={COLORS.primary} />
              </View>
              <Text className="text-2xl font-bold text-white text-center">
                How old are you?
              </Text>
              <Text className="text-sm text-dark-200 mt-2 text-center">
                We use this to find age-appropriate matches
              </Text>
            </View>

            <View className="items-center">
              <TextInput
                value={age}
                onChangeText={(t) => setAge(t.replace(/[^0-9]/g, ""))}
                placeholder="25"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="number-pad"
                maxLength={3}
                className="text-center text-5xl font-bold text-white bg-dark-700 border border-dark-500 rounded-2xl w-40 py-5"
              />
              <Text className="text-xs text-dark-300 mt-3">Must be 18 or older</Text>
            </View>
          </View>
        )}

        {/* ─── GENDER STEP ─── */}
        {step === "gender" && (
          <View className="px-6">
            <View className="items-center mb-8">
              <View className="w-16 h-16 rounded-full bg-accent-500/20 items-center justify-center mb-4">
                <Ionicons name="person-outline" size={32} color={COLORS.accent} />
              </View>
              <Text className="text-2xl font-bold text-white text-center">
                I am a...
              </Text>
              <Text className="text-sm text-dark-200 mt-2 text-center">
                This helps us personalize your experience
              </Text>
            </View>

            <OptionCard
              icon="male-outline"
              label="Male"
              selected={gender === "male"}
              color="#3B82F6"
              onPress={() => setGender("male")}
            />
            <OptionCard
              icon="female-outline"
              label="Female"
              selected={gender === "female"}
              color="#EC4899"
              onPress={() => setGender("female")}
            />
          </View>
        )}

        {/* ─── INTERESTED IN STEP ─── */}
        {step === "interested" && (
          <View className="px-6">
            <View className="items-center mb-8">
              <View className="w-16 h-16 rounded-full bg-primary-500/20 items-center justify-center mb-4">
                <Ionicons name="heart-outline" size={32} color={COLORS.primaryLight} />
              </View>
              <Text className="text-2xl font-bold text-white text-center">
                I am interested in...
              </Text>
              <Text className="text-sm text-dark-200 mt-2 text-center">
                Your AI twin will date matches based on this
              </Text>
            </View>

            <OptionCard
              icon="male-outline"
              label="Males"
              sublabel="Match with male profiles"
              selected={interestedIn === "males"}
              color="#3B82F6"
              onPress={() => setInterestedIn("males")}
            />
            <OptionCard
              icon="female-outline"
              label="Females"
              sublabel="Match with female profiles"
              selected={interestedIn === "females"}
              color="#EC4899"
              onPress={() => setInterestedIn("females")}
            />
            <OptionCard
              icon="people-outline"
              label="Both"
              sublabel="Match with everyone"
              selected={interestedIn === "both"}
              color={COLORS.primary}
              onPress={() => setInterestedIn("both")}
            />
          </View>
        )}

        {/* Spacer */}
        <View className="flex-1" />

        {/* CTA Button */}
        <View className="px-6 pb-8 pt-6">
          <TouchableOpacity
            activeOpacity={canProceed ? 0.85 : 1}
            onPress={step === "interested" ? handleFinish : handleNext}
            className={`rounded-2xl py-4 items-center ${
              canProceed ? "bg-primary-500" : "bg-dark-600"
            }`}
            style={
              canProceed
                ? {
                    shadowColor: COLORS.primary,
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.4,
                    shadowRadius: 12,
                    elevation: 8,
                  }
                : undefined
            }
          >
            <View className="flex-row items-center">
              <Text
                className={`text-lg font-bold mr-2 ${
                  canProceed ? "text-white" : "text-dark-300"
                }`}
              >
                {step === "interested" ? "Let's Go" : "Continue"}
              </Text>
              <Ionicons
                name="arrow-forward"
                size={20}
                color={canProceed ? "#FFFFFF" : COLORS.textMuted}
              />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
