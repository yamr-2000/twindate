import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { COLORS } from "../src/constants/theme";
import { supabase } from "../src/lib/supabase";
import { loadPreferences } from "../src/storage/preferences";

type Mode = "sign_in" | "sign_up";

export default function LoginScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleAuth = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      Alert.alert("Missing Fields", "Please enter both email and password.");
      return;
    }
    if (password.length < 8) {
      Alert.alert("Weak Password", "Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "sign_up") {
        const { error } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
        });
        if (error) throw error;
        Alert.alert(
          "Check Your Email",
          "We sent a confirmation link. After confirming, come back and sign in.",
          [{ text: "OK", onPress: () => setMode("sign_in") }]
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (error) throw error;
        const prefs = await loadPreferences();
        router.replace(prefs ? "/(tabs)" : "/onboarding");
      }
    } catch {
      Alert.alert("Error", "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-dark-800">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="flex-1 px-6 justify-center">
          {/* Logo area */}
          <View className="items-center mb-10">
            <View
              className="w-20 h-20 rounded-full items-center justify-center mb-4"
              style={{ backgroundColor: COLORS.primary + "25" }}
            >
              <Ionicons name="people" size={40} color={COLORS.primary} />
            </View>
            <Text className="text-3xl font-bold text-white">TwinDate</Text>
            <Text className="text-sm text-dark-200 mt-2">
              {mode === "sign_in"
                ? "Sign in to your account"
                : "Create a new account"}
            </Text>
          </View>

          {/* Email */}
          <View className="mb-4">
            <Text className="text-sm text-dark-200 mb-2 ml-1">Email</Text>
            <View className="flex-row items-center bg-dark-700 border border-dark-500 rounded-xl px-4">
              <Ionicons
                name="mail-outline"
                size={18}
                color={COLORS.textMuted}
              />
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                className="flex-1 text-white text-base py-4 ml-3"
              />
            </View>
          </View>

          {/* Password */}
          <View className="mb-6">
            <Text className="text-sm text-dark-200 mb-2 ml-1">Password</Text>
            <View className="flex-row items-center bg-dark-700 border border-dark-500 rounded-xl px-4">
              <Ionicons
                name="lock-closed-outline"
                size={18}
                color={COLORS.textMuted}
              />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Min. 8 characters"
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                className="flex-1 text-white text-base py-4 ml-3"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={COLORS.textMuted}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Submit */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={handleAuth}
            disabled={loading}
            className="bg-primary-500 rounded-2xl py-4 items-center mb-4"
            style={{
              shadowColor: COLORS.primary,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.4,
              shadowRadius: 12,
              elevation: 8,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-white text-base font-bold">
                {mode === "sign_in" ? "Sign In" : "Create Account"}
              </Text>
            )}
          </TouchableOpacity>

          {/* Toggle mode */}
          <TouchableOpacity
            onPress={() =>
              setMode(mode === "sign_in" ? "sign_up" : "sign_in")
            }
            className="items-center py-3"
          >
            <Text className="text-sm text-dark-200">
              {mode === "sign_in"
                ? "Don't have an account? "
                : "Already have an account? "}
              <Text className="text-primary-400 font-semibold">
                {mode === "sign_in" ? "Sign Up" : "Sign In"}
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
