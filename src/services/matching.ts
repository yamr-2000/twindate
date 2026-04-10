import { supabase, isSupabaseConfigured } from "../lib/supabase";
import type { PersonalityProfile, SimulationResult } from "../types/chat";

const AVATAR_COLORS = [
  "#6C3AE1",
  "#F5367B",
  "#10B981",
  "#F59E0B",
  "#06B6D4",
  "#8B50FB",
  "#EC4899",
  "#3B82F6",
];

/**
 * Calls the find-matches Edge Function with the user's embedding vector.
 * Returns results mapped to the existing SimulationResult format.
 */
export async function findCloudMatches(
  embedding: number[],
  interestedIn: string
): Promise<SimulationResult[]> {
  if (!isSupabaseConfigured()) {
    throw new Error("Cloud matching requires Supabase configuration.");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    throw new Error("You must be signed in to find matches.");
  }

  const res = await supabase.functions.invoke("find-matches", {
    body: { embedding, interestedIn },
  });

  if (res.error) {
    throw new Error(res.error.message ?? "Cloud matching failed.");
  }

  interface CloudMatch {
    userId: string;
    displayName: string;
    compatibility: number;
    whyGoodFit: string;
    traits: string[];
  }

  const data = res.data as { matches: CloudMatch[]; message?: string };

  if (!data.matches || data.matches.length === 0) {
    return [];
  }

  return data.matches.map(
    (m: CloudMatch, idx: number): SimulationResult => ({
      id: `cloud-${m.userId}-${Date.now()}`,
      twinId: m.userId,
      twinName: m.displayName,
      avatarColor: AVATAR_COLORS[idx % AVATAR_COLORS.length],
      compatibility: m.compatibility,
      outcome: m.compatibility >= 70 ? "success" : m.compatibility >= 40 ? "neutral" : "no_spark",
      whyGoodFit: m.whyGoodFit,
      conversationHighlight: m.whyGoodFit,
      traits: m.traits,
      simulatedAt: new Date().toISOString(),
    })
  );
}

/**
 * Calls the sync-profile Edge Function to store the profile and embedding
 * in Supabase DB + Pinecone.
 */
export async function syncProfileToCloud(
  profile: PersonalityProfile,
  embedding: number[],
  preferences: { gender: string; interestedIn: string; age: number; displayName: string }
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    console.warn("No session — skipping cloud sync.");
    return;
  }

  const res = await supabase.functions.invoke("sync-profile", {
    body: { profile, embedding, preferences },
  });

  if (res.error) {
    console.warn("Cloud sync failed:", res.error.message);
  }
}

/**
 * Deletes the user's vector from Pinecone and their row from the profiles table.
 */
export async function deleteCloudProfile(): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;

  const userId = session.user.id;

  // Delete from profiles table (cascade via RLS)
  await supabase.from("profiles").delete().eq("id", userId);

  // The Pinecone vector is deleted via the Edge Function.
  // We call a lightweight delete-profile function or handle inline.
  // For simplicity, we'll make a direct Pinecone REST call via Edge Function:
  try {
    await supabase.functions.invoke("sync-profile", {
      body: { _delete: true },
    });
  } catch {
    console.warn("Cloud vector deletion may have failed.");
  }
}
