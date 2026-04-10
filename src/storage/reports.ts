import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DailyReport } from "../types/chat";

const REPORTS_KEY = "@twindate/daily_reports";

export async function loadLocalReports(): Promise<DailyReport[]> {
  const raw = await AsyncStorage.getItem(REPORTS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as DailyReport[];
  } catch {
    return [];
  }
}

export async function saveLocalReport(report: DailyReport): Promise<void> {
  const existing = await loadLocalReports();
  const idx = existing.findIndex((r) => r.date === report.date);
  if (idx >= 0) {
    existing[idx] = report;
  } else {
    existing.unshift(report);
  }
  await AsyncStorage.setItem(REPORTS_KEY, JSON.stringify(existing));
}

export async function clearLocalReports(): Promise<void> {
  await AsyncStorage.removeItem(REPORTS_KEY);
}
