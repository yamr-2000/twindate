import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SECURE_KEY = "twindate_gemini_api_key";
const LEGACY_KEY = "@twindate/gemini_api_key";

export async function saveApiKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(SECURE_KEY, key);
  await AsyncStorage.removeItem(LEGACY_KEY);
}

export async function getApiKey(): Promise<string | null> {
  const secure = await SecureStore.getItemAsync(SECURE_KEY);
  if (secure) return secure;

  const legacy = await AsyncStorage.getItem(LEGACY_KEY);
  if (legacy) {
    await SecureStore.setItemAsync(SECURE_KEY, legacy);
    await AsyncStorage.removeItem(LEGACY_KEY);
    return legacy;
  }

  return null;
}

export async function deleteApiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(SECURE_KEY);
  await AsyncStorage.removeItem(LEGACY_KEY);
}
