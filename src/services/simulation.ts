import { getApiKey } from "../storage/settings";
import type { PersonalityProfile, DigitalTwin, SimulationResult } from "../types/chat";

const MODEL = "gemini-2.5-flash-lite";
const MAX_RETRIES = 2;

function getEndpoint(apiKey: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = MAX_RETRIES
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(url, options);
    if (response.ok || response.status === 400 || response.status === 403) {
      return response;
    }
    if ((response.status === 429 || response.status >= 500) && attempt < retries) {
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
      continue;
    }
    return response;
  }
  return fetch(url, options);
}

function buildSimulationPrompt(
  userProfile: PersonalityProfile,
  twin: DigitalTwin
): string {
  return `You are a dating simulation engine. You will simulate a first-date text conversation between two people based on their personality profiles, then evaluate compatibility.

## Person A: "${userProfile.primarySender}"
- Communication Style: ${userProfile.communicationStyle}
- Humor: ${userProfile.humor}
- Emoji Usage: ${userProfile.emojiUsage}
- Response Patterns: ${userProfile.responsePatterns}
- Flirting Style: ${userProfile.flirtingStyle}
- Top Topics: ${userProfile.topTopics.join(", ")}
- Overall: ${userProfile.overallSummary}

## Person B: "${twin.name}" (age ${twin.age})
- Communication Style: ${twin.personality.communicationStyle}
- Humor: ${twin.personality.humor}
- Emoji Usage: ${twin.personality.emojiUsage}
- Response Patterns: ${twin.personality.responsePatterns}
- Flirting Style: ${twin.personality.flirtingStyle}
- Top Topics: ${twin.personality.topTopics.join(", ")}
- Overall: ${twin.personality.overallSummary}

## Instructions
1. Simulate a realistic 10-15 message first-date conversation between them. Each person should talk in their authentic style.
2. The conversation should naturally progress — opening, finding common ground, building rapport (or not).
3. At the end, determine the outcome: did both people express interest in meeting? Or did the chemistry fizzle?

Return ONLY a JSON object with this exact structure (no markdown fences):

{
  "compatibility": <number 0-100>,
  "outcome": "<success|neutral|no_spark>",
  "whyGoodFit": "2-3 sentences explaining why they are or aren't compatible, based on the conversation dynamics.",
  "conversationHighlight": "The single best exchange from the simulated conversation (2-4 messages). Format as: PersonName: message | PersonName: response",
  "traits": ["3-5", "word", "tags", "describing", "their dynamic"]
}

Rules for outcome:
- "success": compatibility >= 75, both show clear mutual interest and agree/hint at meeting
- "neutral": compatibility 50-74, pleasant but no strong spark
- "no_spark": compatibility < 50, awkward or mismatched energy

Be realistic — not every pair should match. Base compatibility strictly on how well their communication styles, humor, and interests mesh.`;
}

function cleanJsonResponse(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*\n?/m, "")
    .replace(/\n?```\s*$/m, "")
    .trim();
}

export async function simulateDate(
  userProfile: PersonalityProfile,
  twin: DigitalTwin
): Promise<SimulationResult> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error("Gemini API key not configured.");
  }

  const systemPrompt = buildSimulationPrompt(userProfile, twin);

  const response = await fetchWithRetry(getEndpoint(apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Simulate the first-date conversation between ${userProfile.primarySender} and ${twin.name} now. Return only JSON.`,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.85,
        maxOutputTokens: 1500,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Simulation failed for ${twin.name} (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error(`Empty simulation response for ${twin.name}.`);

  const cleaned = cleanJsonResponse(raw);

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Failed to parse simulation result for ${twin.name}.`);
  }

  const compatibility = Math.min(100, Math.max(0, Number(parsed.compatibility) || 50));
  let outcome = String(parsed.outcome || "neutral") as SimulationResult["outcome"];
  if (!["success", "neutral", "no_spark"].includes(outcome)) {
    outcome = compatibility >= 75 ? "success" : compatibility >= 50 ? "neutral" : "no_spark";
  }

  return {
    id: `sim-${twin.id}-${Date.now()}`,
    twinId: twin.id,
    twinName: twin.name,
    avatarColor: twin.avatarColor,
    compatibility,
    outcome,
    whyGoodFit: String(parsed.whyGoodFit ?? ""),
    conversationHighlight: String(parsed.conversationHighlight ?? ""),
    traits: Array.isArray(parsed.traits) ? parsed.traits.map(String) : [],
    simulatedAt: new Date().toISOString(),
  };
}

/**
 * Run simulations against all twins with limited concurrency (2 at a time).
 * Calls onProgress after each twin completes.
 */
export async function runAllSimulations(
  userProfile: PersonalityProfile,
  twins: DigitalTwin[],
  onProgress?: (completed: number, total: number, latest: SimulationResult) => void
): Promise<SimulationResult[]> {
  const results: SimulationResult[] = [];
  let completed = 0;
  const concurrency = 2;

  const queue = [...twins];

  async function runNext(): Promise<void> {
    while (queue.length > 0) {
      const twin = queue.shift()!;
      const result = await simulateDate(userProfile, twin);
      results.push(result);
      completed++;
      onProgress?.(completed, twins.length, result);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, twins.length) }, () => runNext());
  await Promise.all(workers);

  return results.sort((a, b) => b.compatibility - a.compatibility);
}
