import { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { isSupabaseConfigured, supabase } from "../src/lib/supabase";
import { loadPreferences } from "../src/storage/preferences";
import { COLORS } from "../src/constants/theme";

export default function Index() {
  const [ready, setReady] = useState(false);
  const [route, setRoute] = useState<"login" | "onboarding" | "tabs">("login");

  useEffect(() => {
    (async () => {
      if (!isSupabaseConfigured()) {
        // Supabase not configured — fall back to local-only flow
        const prefs = await loadPreferences();
        setRoute(prefs ? "tabs" : "onboarding");
        setReady(true);
        return;
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          setRoute("login");
        } else {
          const prefs = await loadPreferences();
          setRoute(prefs ? "tabs" : "onboarding");
        }
      } catch {
        // If Supabase call fails, skip to preferences check
        const prefs = await loadPreferences();
        setRoute(prefs ? "tabs" : "onboarding");
      }

      setReady(true);
    })();
  }, []);

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#0E0E20",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (route === "login") return <Redirect href="/login" />;
  if (route === "onboarding") return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)" />;
}
