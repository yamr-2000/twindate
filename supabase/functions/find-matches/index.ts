import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PINECONE_API_KEY = Deno.env.get("PINECONE_API_KEY")!;
const PINECONE_INDEX_HOST = Deno.env.get("PINECONE_INDEX_HOST")!;
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const GEMINI_MODEL = "gemini-2.5-flash-lite";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface MatchResult {
  userId: string;
  displayName: string;
  compatibility: number;
  whyGoodFit: string;
  traits: string[];
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      SUPABASE_URL,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { embedding, interestedIn } = await req.json();

    if (
      !embedding ||
      !Array.isArray(embedding) ||
      embedding.length !== 384 ||
      !embedding.every((v: unknown) => typeof v === "number" && isFinite(v as number))
    ) {
      return new Response(
        JSON.stringify({ error: "Invalid embedding: expected 384 finite floats" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 1. Query Pinecone for the 10 most similar vectors
    const filter: Record<string, unknown> = {};
    if (interestedIn === "males") {
      filter.gender = { $eq: "male" };
    } else if (interestedIn === "females") {
      filter.gender = { $eq: "female" };
    }

    const pineconeRes = await fetch(
      `https://${PINECONE_INDEX_HOST}/query`,
      {
        method: "POST",
        headers: {
          "Api-Key": PINECONE_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vector: embedding,
          topK: 11,
          includeMetadata: true,
          filter: Object.keys(filter).length > 0 ? filter : undefined,
        }),
      }
    );

    if (!pineconeRes.ok) {
      const errText = await pineconeRes.text();
      return new Response(
        JSON.stringify({ error: "Vector search failed", detail: errText }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const pineconeData = await pineconeRes.json();
    const candidates = (pineconeData.matches ?? [])
      .filter((m: { id: string }) => m.id !== user.id)
      .slice(0, 10);

    if (candidates.length === 0) {
      return new Response(
        JSON.stringify({ matches: [], message: "No compatible users found yet." }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 2. Load candidate profiles from Supabase
    const candidateIds = candidates.map((c: { id: string }) => c.id);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: profiles, error: dbError } = await supabase
      .from("profiles")
      .select("id, display_name, ai_personality_summary")
      .in("id", candidateIds);

    if (dbError) {
      return new Response(
        JSON.stringify({ error: "Profile fetch failed", detail: dbError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 3. Load requesting user's profile
    const { data: myProfile } = await supabase
      .from("profiles")
      .select("display_name, ai_personality_summary")
      .eq("id", user.id)
      .single();

    if (!myProfile?.ai_personality_summary) {
      return new Response(
        JSON.stringify({ error: "Your personality profile is not ready yet." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 4. Batch evaluation with Gemini (5 at a time)
    const allMatches: MatchResult[] = [];
    const validProfiles = (profiles ?? []).filter(
      (p) => p.ai_personality_summary
    );

    for (let i = 0; i < validProfiles.length; i += 5) {
      const batch = validProfiles.slice(i, i + 5);

      const candidateDescriptions = batch
        .map((p, idx) => {
          const summary = p.ai_personality_summary;
          return `Candidate ${idx + 1} (ID: ${p.id}, Name: ${p.display_name}):\n${
            typeof summary === "string"
              ? summary
              : JSON.stringify(summary)
          }`;
        })
        .join("\n\n");

      const prompt = `You are a dating compatibility analyzer. Given the requesting user's personality profile and ${batch.length} candidate profiles, pick the 2 best matches.

REQUESTING USER (${myProfile.display_name}):
${typeof myProfile.ai_personality_summary === "string" ? myProfile.ai_personality_summary : JSON.stringify(myProfile.ai_personality_summary)}

CANDIDATES:
${candidateDescriptions}

Return ONLY a valid JSON array (no markdown, no backticks) with exactly 2 objects. Each object must have:
- "userId": the candidate's ID string
- "displayName": the candidate's name
- "compatibility": a number 0-100
- "whyGoodFit": a 1-2 sentence explanation
- "traits": an array of 3 shared/complementary trait keywords`;

      const geminiRes = await fetch(GEMINI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1024,
          },
        }),
      });

      if (!geminiRes.ok) {
        console.error("Gemini batch eval failed:", await geminiRes.text());
        continue;
      }

      const geminiData = await geminiRes.json();
      const rawText =
        geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

      try {
        const jsonMatch = rawText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsed: unknown[] = JSON.parse(jsonMatch[0]);
          const batchIds = new Set(batch.map((p) => p.id));
          for (const item of parsed) {
            const m = item as Record<string, unknown>;
            if (
              typeof m.userId === "string" &&
              batchIds.has(m.userId) &&
              typeof m.compatibility === "number" &&
              typeof m.whyGoodFit === "string"
            ) {
              allMatches.push({
                userId: m.userId,
                displayName: String(m.displayName ?? "Unknown"),
                compatibility: Math.min(100, Math.max(0, m.compatibility)),
                whyGoodFit: m.whyGoodFit,
                traits: Array.isArray(m.traits) ? m.traits.map(String) : [],
              });
            }
          }
        }
      } catch (parseErr) {
        console.error("Failed to parse Gemini response:", parseErr);
      }
    }

    // Sort by compatibility descending, return top results
    allMatches.sort((a, b) => b.compatibility - a.compatibility);
    const topMatches = allMatches.slice(0, 5);

    return new Response(
      JSON.stringify({ matches: topMatches }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("find-matches error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
