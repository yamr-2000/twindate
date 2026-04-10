import { getApiKey } from "../storage/settings";
import { saveLocalReport, loadLocalReports } from "../storage/reports";
import { supabase, isSupabaseConfigured } from "../lib/supabase";
import type { SimulationResult, PersonalityProfile, DailyReport } from "../types/chat";

const MODEL = "gemini-2.5-flash-lite";

function getEndpoint(apiKey: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
}

function todayDateString(): string {
  return new Date().toISOString().split("T")[0];
}

function buildInsightPrompt(
  profile: PersonalityProfile,
  results: SimulationResult[]
): string {
  const summaries = results.map(
    (r) =>
      `- ${r.twinName}: compatibility ${r.compatibility}%, outcome: ${r.outcome}. ` +
      `Traits: [${r.traits.join(", ")}]. Why: ${r.whyGoodFit}`
  );

  return `You are a dating coach AI. A user's AI Twin just completed ${results.length} simulated first-date conversations. Analyze the outcomes and give the user ONE specific, actionable insight to improve their match rate.

USER'S PERSONALITY:
- Communication: ${profile.communicationStyle}
- Humor: ${profile.humor}
- Emoji Usage: ${profile.emojiUsage}
- Response Style: ${profile.responsePatterns}
- Flirting Style: ${profile.flirtingStyle}

SIMULATION RESULTS:
${summaries.join("\n")}

Return ONLY a JSON object with these fields:
{
  "vibeTraits": ["trait1", "trait2", "trait3"],
  "insight": "One specific, friendly tip in 1-2 sentences. Address the user as 'you'. Reference specific patterns you noticed in their simulation results. Be constructive, not critical. Example: 'Your Twin is great at banter but tends to dominate the conversation — try asking more questions to let matches open up.'"
}

Rules for vibeTraits: Pick exactly 3 short trait labels (2-3 words each) that describe the TYPE of person this user vibes best with, based on who scored highest. Examples: "Witty Banter Lovers", "Chill Conversationalists", "Deep Thinkers".

Rules for insight: Be specific to THIS user's results. Reference actual names or patterns. Do NOT give generic advice. Keep it warm and encouraging.`;
}

async function generateInsight(
  profile: PersonalityProfile,
  results: SimulationResult[]
): Promise<{ vibeTraits: string[]; insight: string }> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    return {
      vibeTraits: deriveTraitsFallback(results),
      insight: buildFallbackInsight(results),
    };
  }

  try {
    const response = await fetch(getEndpoint(apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { parts: [{ text: buildInsightPrompt(profile, results) }] },
        ],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 400,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!response.ok) {
      console.warn("Gemini insight call failed:", response.status);
      return {
        vibeTraits: deriveTraitsFallback(results),
        insight: buildFallbackInsight(results),
      };
    }

    const data = await response.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const cleaned = raw.replace(/^```(?:json)?\s*\n?/m, "").replace(/\n?```\s*$/m, "").trim();
    const parsed = JSON.parse(cleaned);

    return {
      vibeTraits: Array.isArray(parsed.vibeTraits)
        ? parsed.vibeTraits.map(String).slice(0, 3)
        : deriveTraitsFallback(results),
      insight: typeof parsed.insight === "string"
        ? parsed.insight
        : buildFallbackInsight(results),
    };
  } catch {
    return {
      vibeTraits: deriveTraitsFallback(results),
      insight: buildFallbackInsight(results),
    };
  }
}

function deriveTraitsFallback(results: SimulationResult[]): string[] {
  const allTraits = results
    .filter((r) => r.outcome === "success" || r.compatibility >= 60)
    .flatMap((r) => r.traits);

  const counts = new Map<string, number>();
  for (const t of allTraits) {
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => t);
}

function buildFallbackInsight(results: SimulationResult[]): string {
  const best = results.reduce((a, b) =>
    a.compatibility > b.compatibility ? a : b
  );
  const worst = results.reduce((a, b) =>
    a.compatibility < b.compatibility ? a : b
  );

  if (best.compatibility >= 70) {
    return (
      `Your Twin clicked best with ${best.twinName} (${best.compatibility}%). ` +
      `The key was shared energy in ${best.traits.slice(0, 2).join(" and ")}. ` +
      `Keep leaning into that vibe!`
    );
  }

  return (
    `Today's best was ${best.twinName} at ${best.compatibility}% and the toughest was ` +
    `${worst.twinName} at ${worst.compatibility}%. Try loosening up your tone a bit — ` +
    `a warmer opening message can work wonders.`
  );
}

/**
 * Generate a daily report from simulation results and persist it.
 * Returns the created report.
 */
export async function generateDailyReport(
  profile: PersonalityProfile,
  results: SimulationResult[]
): Promise<DailyReport> {
  const { vibeTraits, insight } = await generateInsight(profile, results);

  const successes = results.filter((r) => r.outcome === "success");
  const best = results.reduce((a, b) =>
    a.compatibility > b.compatibility ? a : b
  );

  const report: DailyReport = {
    id: `report-${Date.now()}`,
    date: todayDateString(),
    peopleCount: results.length,
    matchCount: successes.length,
    bestMatchName: best.twinName,
    bestMatchScore: best.compatibility,
    vibeTraits,
    dailyInsight: insight,
    createdAt: new Date().toISOString(),
  };

  await saveLocalReport(report);

  if (isSupabaseConfigured()) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.from("daily_reports").upsert(
          {
            user_id: session.user.id,
            report_date: report.date,
            people_count: report.peopleCount,
            match_count: report.matchCount,
            best_match_name: report.bestMatchName,
            best_match_score: report.bestMatchScore,
            vibe_traits: report.vibeTraits,
            daily_insight: report.dailyInsight,
          },
          { onConflict: "user_id,report_date" }
        );
      }
    } catch (err) {
      console.warn("Failed to save report to cloud:", err);
    }
  }

  return report;
}

/**
 * Load all reports, merging local + cloud data.
 * Cloud reports take precedence for the same date.
 */
export async function loadAllReports(): Promise<DailyReport[]> {
  const local = await loadLocalReports();

  if (!isSupabaseConfigured()) return local;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return local;

    const { data, error } = await supabase
      .from("daily_reports")
      .select("*")
      .eq("user_id", session.user.id)
      .order("report_date", { ascending: false })
      .limit(90);

    if (error || !data) return local;

    const cloudReports: DailyReport[] = data.map((row) => ({
      id: row.id,
      date: row.report_date,
      peopleCount: row.people_count,
      matchCount: row.match_count,
      bestMatchName: row.best_match_name,
      bestMatchScore: row.best_match_score,
      vibeTraits: row.vibe_traits ?? [],
      dailyInsight: row.daily_insight,
      createdAt: row.created_at,
    }));

    const dateMap = new Map<string, DailyReport>();
    for (const r of local) dateMap.set(r.date, r);
    for (const r of cloudReports) dateMap.set(r.date, r);

    return [...dateMap.values()].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  } catch {
    return local;
  }
}
