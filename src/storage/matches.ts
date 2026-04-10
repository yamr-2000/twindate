import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SimulationResult } from "../types/chat";

const MATCHES_KEY = "@twindate/simulation_results";

export async function saveMatches(results: SimulationResult[]): Promise<void> {
  await AsyncStorage.setItem(MATCHES_KEY, JSON.stringify(results));
}

export async function loadMatches(): Promise<SimulationResult[]> {
  const raw = await AsyncStorage.getItem(MATCHES_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as SimulationResult[];
  } catch {
    return [];
  }
}

export async function clearMatches(): Promise<void> {
  await AsyncStorage.removeItem(MATCHES_KEY);
}
