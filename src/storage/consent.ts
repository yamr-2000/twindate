import AsyncStorage from "@react-native-async-storage/async-storage";

const CONSENT_KEY = "@twindate/privacy_consent";

export async function hasConsented(): Promise<boolean> {
  const value = await AsyncStorage.getItem(CONSENT_KEY);
  return value === "true";
}

export async function saveConsent(): Promise<void> {
  await AsyncStorage.setItem(CONSENT_KEY, "true");
}

export async function revokeConsent(): Promise<void> {
  await AsyncStorage.removeItem(CONSENT_KEY);
}
