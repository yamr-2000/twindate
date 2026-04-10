import AsyncStorage from "@react-native-async-storage/async-storage";
import type { UserPreferences } from "../types/chat";

const PREFS_KEY = "@twindate/user_preferences";

export async function savePreferences(prefs: UserPreferences): Promise<void> {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

export async function loadPreferences(): Promise<UserPreferences | null> {
  const raw = await AsyncStorage.getItem(PREFS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserPreferences;
  } catch {
    return null;
  }
}

export async function deletePreferences(): Promise<void> {
  await AsyncStorage.removeItem(PREFS_KEY);
}
