import * as Notifications from "expo-notifications";
import type { SimulationResult } from "../types/chat";

let handlerConfigured = false;

function ensureHandler(): void {
  if (handlerConfigured) return;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
    handlerConfigured = true;
  } catch (e) {
    console.warn("Notifications handler setup failed:", e);
  }
}

export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    ensureHandler();
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") return true;

    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

export async function sendMatchNotification(result: SimulationResult): Promise<void> {
  try {
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: `It's a match! ${result.twinName}`,
        body: `${result.compatibility}% compatible`,
        data: { matchId: result.id, twinId: result.twinId },
        sound: true,
      },
      trigger: null,
    });
  } catch (e) {
    console.warn("Failed to send notification:", e);
  }
}
