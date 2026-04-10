import { useState, useEffect, useRef } from "react";
import { NativeModules } from "react-native";
import type { PersonalityProfile } from "../types/chat";

/**
 * Converts a PersonalityProfile into a single text string for embedding.
 */
export function profileToText(profile: PersonalityProfile): string {
  return [
    profile.communicationStyle,
    profile.humor,
    profile.emojiUsage,
    profile.responsePatterns,
    profile.flirtingStyle,
    profile.topTopics.join(", "),
    profile.overallSummary,
  ].join(" ");
}

/**
 * Detect at module-load time whether the ExecuTorch native module is linked.
 * In Expo Go it won't be; in a development build it will.
 */
const HAS_EXECUTORCH = (() => {
  try {
    return (
      !!NativeModules.ExecuTorch ||
      !!NativeModules.RNExecuTorch ||
      !!NativeModules.NaturalLanguageProcessing
    );
  } catch {
    return false;
  }
})();

const NOT_AVAILABLE_MSG =
  "On-device embeddings require a Development Build with react-native-executorch. " +
  "Run: npx expo prebuild && npx expo run:ios";

/**
 * Safe hook for on-device embedding generation.
 *
 * - In Expo Go (no native module): returns a no-op fallback without calling
 *   any native hooks, so the Rules of Hooks are never violated.
 * - In a Development Build: delegates to react-native-executorch.
 */
export function useEmbedding(): {
  generate: (profile: PersonalityProfile) => Promise<number[]>;
  ready: boolean;
  error: string | null;
} {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(
    HAS_EXECUTORCH ? null : NOT_AVAILABLE_MSG
  );
  const modelRef = useRef<{ forward: (text: string) => Promise<unknown> } | null>(null);

  useEffect(() => {
    if (!HAS_EXECUTORCH) return;

    let cancelled = false;

    (async () => {
      try {
        const mod = require("react-native-executorch");
        const NLP =
          mod.useNaturalLanguageProcessing ?? mod.NaturalLanguageProcessing;

        if (typeof NLP === "function" && NLP.length !== undefined) {
          // It's a hook — can't call it here. Flag that the dev build path
          // should use the hook-based wrapper component instead.
          // For now, mark as unavailable in this plain-hook context.
          if (!cancelled) {
            setError(
              "ExecuTorch detected but requires the hook-based API. " +
                "Embedding generation will be skipped."
            );
          }
          return;
        }

        // Class/function-based API
        const model = await NLP({ modelSource: "all-MiniLM-L6-v2" });
        if (!cancelled) {
          modelRef.current = model;
          setReady(true);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Embedding init failed.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const generate = async (profile: PersonalityProfile): Promise<number[]> => {
    if (!modelRef.current) {
      throw new Error(error ?? NOT_AVAILABLE_MSG);
    }
    const text = profileToText(profile);
    const result = await modelRef.current.forward(text);
    return Array.isArray(result) ? Array.from(result) : Array.from(result as Iterable<number>);
  };

  return { generate, ready, error };
}
