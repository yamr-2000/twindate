import { PersonalityProfile } from "../types/chat";
import { getApiKey } from "../storage/settings";

const MODEL = "gemini-2.5-flash-lite";
const MAX_RETRIES = 3;

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
    if (response.status === 429 && attempt < retries) {
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }
    if (response.status >= 500 && attempt < retries) {
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }
    return response;
  }
  return fetch(url, options);
}

const SYSTEM_PROMPT = `You are a world-class personality analyst specializing in digital communication patterns. You will receive a sample of someone's chat messages. Analyze them and return a JSON object with EXACTLY this structure — no markdown fences, no extra keys:

{
  "communicationStyle": "2-3 sentence description of how you communicate (formal vs casual, verbose vs terse, question-asker vs storyteller, etc.)",
  "humor": "2-3 sentences on your sense of humor — sarcastic, dry, goofy, meme-heavy, pun-lover, self-deprecating, etc. Include specific examples if visible.",
  "emojiUsage": "1-2 sentences on your emoji/emoticon habits — heavy user, minimal, specific favorites, strategic placement, etc.",
  "responsePatterns": "2-3 sentences on how you tend to respond — quick-fire short replies, long thoughtful paragraphs, voice-note references, late-night texter, etc.",
  "flirtingStyle": "2-3 sentences on your flirting or social warmth style — direct, playful teasing, compliment-heavy, shy, intellectual banter, etc.",
  "topTopics": ["array", "of", "5-8", "topics", "you", "talk", "about", "most"],
  "overallSummary": "A single paragraph (4-5 sentences) painting a vivid picture of your texting personality, written directly to you."
}

Rules:
- IMPORTANT: Write everything in second person — address the user as "you" and "your". Never say "this user", "they", "he", "she", or refer to them by name. Speak directly to the person reading it.
- Base ALL observations strictly on the messages provided. Do not invent traits.
- If there is insufficient data for a field, say "Not enough data to determine."
- Return ONLY valid JSON. No explanations outside the JSON.`;

export async function analyzePersonality(
  messageSample: string[],
  senderName: string
): Promise<PersonalityProfile> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error(
      "Gemini API key not configured. Go to Profile → Gemini Configuration to add it."
    );
  }

  const userContent = `Here are ${messageSample.length} messages from "${senderName}":\n\n${messageSample.map((m, i) => `[${i + 1}] ${m}`).join("\n")}`;

  const requestBody = JSON.stringify({
    system_instruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: userContent }],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1200,
      responseMimeType: "application/json",
    },
  });

  const response = await fetchWithRetry(getEndpoint(apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: requestBody,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    if (response.status === 400 || response.status === 403) {
      throw new Error("Invalid API key. Check your Gemini key in Settings.");
    }
    if (response.status === 429) {
      throw new Error("Rate limited by Gemini. Please wait a moment and try again.");
    }
    throw new Error(`Gemini API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!raw) {
    throw new Error("Empty response from Gemini.");
  }

  const cleaned = raw.replace(/^```(?:json)?\s*\n?/m, "").replace(/\n?```\s*$/m, "").trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("Failed to parse personality analysis. The AI returned malformed JSON.");
  }

  return {
    communicationStyle: String(parsed.communicationStyle ?? ""),
    humor: String(parsed.humor ?? ""),
    emojiUsage: String(parsed.emojiUsage ?? ""),
    responsePatterns: String(parsed.responsePatterns ?? ""),
    flirtingStyle: String(parsed.flirtingStyle ?? ""),
    topTopics: Array.isArray(parsed.topTopics)
      ? parsed.topTopics.map(String)
      : [],
    overallSummary: String(parsed.overallSummary ?? ""),
    analyzedAt: new Date().toISOString(),
    messageCount: messageSample.length,
    primarySender: senderName,
  };
}
