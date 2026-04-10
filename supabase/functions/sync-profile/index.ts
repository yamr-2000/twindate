import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PINECONE_API_KEY = Deno.env.get("PINECONE_API_KEY")!;
const PINECONE_INDEX_HOST = Deno.env.get("PINECONE_INDEX_HOST")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
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

    const body = await req.json();

    // Handle deletion request
    if (body._delete === true) {
      const deleteRes = await fetch(
        `https://${PINECONE_INDEX_HOST}/vectors/delete`,
        {
          method: "POST",
          headers: {
            "Api-Key": PINECONE_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ids: [user.id] }),
        }
      );
      if (!deleteRes.ok) {
        console.error("Pinecone delete failed:", await deleteRes.text());
      }

      await supabase.from("profiles").delete().eq("id", user.id);

      return new Response(
        JSON.stringify({ success: true, deleted: true }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { profile, embedding, preferences } = body;

    if (!profile || !embedding || !Array.isArray(embedding)) {
      return new Response(
        JSON.stringify({ error: "Missing profile or embedding" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (
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

    // 1. Upsert vector to Pinecone
    const pineconeRes = await fetch(
      `https://${PINECONE_INDEX_HOST}/vectors/upsert`,
      {
        method: "POST",
        headers: {
          "Api-Key": PINECONE_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vectors: [
            {
              id: user.id,
              values: embedding,
              metadata: {
                gender: preferences?.gender ?? "unknown",
                interested_in: preferences?.interestedIn ?? "both",
                age: preferences?.age ?? 0,
                display_name: preferences?.displayName ?? "User",
              },
            },
          ],
        }),
      }
    );

    if (!pineconeRes.ok) {
      const errText = await pineconeRes.text();
      console.error("Pinecone upsert failed:", errText);
      return new Response(
        JSON.stringify({ error: "Vector storage failed", detail: errText }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 2. Update profiles table with personality summary
    const { error: dbError } = await supabase
      .from("profiles")
      .update({
        ai_personality_summary: profile,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (dbError) {
      console.error("DB update failed:", dbError.message);
      return new Response(
        JSON.stringify({ error: "Profile update failed", detail: dbError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("sync-profile error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
