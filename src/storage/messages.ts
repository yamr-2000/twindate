import AsyncStorage from "@react-native-async-storage/async-storage";

const MESSAGES_KEY = "@twindate/accumulated_messages";
const MAX_MESSAGES = 5000;

export async function loadAccumulatedMessages(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(MESSAGES_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export async function saveAccumulatedMessages(messages: string[]): Promise<void> {
  const capped = messages.length > MAX_MESSAGES
    ? messages.slice(messages.length - MAX_MESSAGES)
    : messages;
  await AsyncStorage.setItem(MESSAGES_KEY, JSON.stringify(capped));
}

export async function clearAccumulatedMessages(): Promise<void> {
  await AsyncStorage.removeItem(MESSAGES_KEY);
}
