import AsyncStorage from "@react-native-async-storage/async-storage";
import { PersonalityProfile } from "../types/chat";

const PROFILE_KEY = "@twindate/personality_profile";

export async function saveProfile(profile: PersonalityProfile): Promise<void> {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export async function loadProfile(): Promise<PersonalityProfile | null> {
  const raw = await AsyncStorage.getItem(PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PersonalityProfile;
  } catch {
    return null;
  }
}

export async function deleteProfile(): Promise<void> {
  await AsyncStorage.removeItem(PROFILE_KEY);
}
