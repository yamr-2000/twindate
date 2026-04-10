import { useEffect } from "react";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Alert } from "react-native";
import { ErrorBoundary } from "./ErrorBoundary";
import { isSupabaseConfigured, supabase } from "../src/lib/supabase";

import "../global.css";

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
          if (event === "SIGNED_OUT") {
            Alert.alert(
              "Session Expired",
              "Please sign in again.",
              [{ text: "OK", onPress: () => router.replace("/login") }]
            );
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [router]);

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "#0E0E20" },
            animation: "fade",
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="welcome" />
          <Stack.Screen name="login" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
