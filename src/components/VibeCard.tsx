import React, { useRef, useCallback, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import ViewShot from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import type { PersonalityProfile } from "../types/chat";

interface VibeCardProps {
  profile: PersonalityProfile;
  compatibilityScore?: number | null;
}

const TRAIT_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  sarcastic: "skull-outline",
  funny: "happy-outline",
  goofy: "happy-outline",
  "meme-heavy": "image-outline",
  casual: "cafe-outline",
  formal: "briefcase-outline",
  verbose: "document-text-outline",
  terse: "flash-outline",
  emoji: "heart-outline",
  "night owl": "moon-outline",
  "early bird": "sunny-outline",
  "fast replier": "flash-outline",
  "slow replier": "time-outline",
  playful: "game-controller-outline",
  direct: "arrow-forward-outline",
  shy: "eye-off-outline",
  intellectual: "book-outline",
  storyteller: "chatbubbles-outline",
  teasing: "flame-outline",
  warm: "heart-circle-outline",
};

function findTraitIcon(trait: string): keyof typeof Ionicons.glyphMap {
  const lower = trait.toLowerCase();
  for (const [keyword, icon] of Object.entries(TRAIT_ICONS)) {
    if (lower.includes(keyword)) return icon;
  }
  return "sparkles-outline";
}

/**
 * Extract 3 punchy trait labels from the personality profile by scanning
 * the AI-generated text fields for strong descriptors.
 */
function extractTraits(profile: PersonalityProfile): string[] {
  const traits: string[] = [];
  const seen = new Set<string>();

  const traitPatterns: [RegExp, string][] = [
    [/sarcas/i, "Sarcastic"],
    [/dry\s*(humor|wit)/i, "Dry Wit"],
    [/goofy/i, "Goofy"],
    [/meme/i, "Meme Lord"],
    [/self.deprecat/i, "Self-Deprecating"],
    [/pun/i, "Pun Master"],
    [/night\s*(owl)?/i, "Night Owl"],
    [/late.night/i, "Night Owl"],
    [/early\s*(bird|morning)/i, "Early Bird"],
    [/quick.fire|fast\s*repl|rapid/i, "Fast Replier"],
    [/slow\s*repl|takes?\s*time/i, "Slow Replier"],
    [/emoji\s*(heavy|lover|addict)/i, "Emoji Addict"],
    [/minimal\s*emoji/i, "Emoji Minimalist"],
    [/storytell/i, "Storyteller"],
    [/verbose|long\s*(message|paragraph|text)/i, "Verbose Texter"],
    [/terse|short\s*(message|repl)/i, "Short & Sweet"],
    [/playful\s*(teas|banter)/i, "Playful Teaser"],
    [/direct|straightforward/i, "Direct"],
    [/intellectual\s*banter/i, "Intellectual"],
    [/flirt/i, "Natural Flirt"],
    [/compliment/i, "Compliment King"],
    [/question.ask/i, "Question Asker"],
    [/casual/i, "Casual Vibes"],
    [/formal/i, "Formal Tone"],
    [/warm/i, "Warm Energy"],
    [/support/i, "Supportive"],
    [/voice.note/i, "Voice Note Fan"],
  ];

  const searchText = [
    profile.communicationStyle,
    profile.humor,
    profile.responsePatterns,
    profile.flirtingStyle,
    profile.emojiUsage,
  ].join(" ");

  for (const [pattern, label] of traitPatterns) {
    if (traits.length >= 3) break;
    if (pattern.test(searchText) && !seen.has(label)) {
      traits.push(label);
      seen.add(label);
    }
  }

  if (traits.length < 3 && profile.topTopics.length > 0) {
    for (const topic of profile.topTopics) {
      if (traits.length >= 3) break;
      const capitalized = topic.charAt(0).toUpperCase() + topic.slice(1);
      if (!seen.has(capitalized)) {
        traits.push(capitalized);
        seen.add(capitalized);
      }
    }
  }

  while (traits.length < 3) {
    traits.push(["Unique Vibe", "Deep Thinker", "Chat Lover"][traits.length]);
  }

  return traits.slice(0, 3);
}

function CardContent({ profile, compatibilityScore, traits }: {
  profile: PersonalityProfile;
  compatibilityScore?: number | null;
  traits: string[];
}) {
  return (
    <LinearGradient
      colors={["#8B50FB", "#6C3AE1", "#3A1D8E", "#0E0E20"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: 360,
        borderRadius: 28,
        overflow: "hidden",
      }}
    >
      {/* Decorative circles */}
      <View
        style={{
          position: "absolute",
          top: -40,
          right: -40,
          width: 160,
          height: 160,
          borderRadius: 80,
          backgroundColor: "rgba(245, 54, 123, 0.15)",
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: -30,
          left: -30,
          width: 120,
          height: 120,
          borderRadius: 60,
          backgroundColor: "rgba(108, 58, 225, 0.2)",
        }}
      />

      <View style={{ padding: 32 }}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              backgroundColor: "rgba(255,255,255,0.15)",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 8,
            }}
          >
            <Ionicons name="people" size={14} color="#FFFFFF" />
          </View>
          <Text
            style={{
              fontSize: 13,
              fontWeight: "700",
              color: "rgba(255,255,255,0.6)",
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            TwinDate
          </Text>
        </View>

        {/* Title */}
        <Text
          style={{
            fontSize: 14,
            fontWeight: "600",
            color: "rgba(255,255,255,0.5)",
            marginBottom: 4,
            letterSpacing: 0.5,
          }}
        >
          Communication Card
        </Text>

        {/* Twin Name */}
        <Text
          style={{
            fontSize: 32,
            fontWeight: "800",
            color: "#FFFFFF",
            marginBottom: 24,
            lineHeight: 38,
          }}
        >
          {profile.primarySender}
          <Text style={{ color: "rgba(245, 54, 123, 0.9)" }}>{"'"}s</Text>
          {"\n"}
          <Text style={{ color: "rgba(255,255,255,0.85)" }}>Vibe</Text>
        </Text>

        {/* Divider */}
        <View
          style={{
            height: 1,
            backgroundColor: "rgba(255,255,255,0.1)",
            marginBottom: 24,
          }}
        />

        {/* Top Traits */}
        <Text
          style={{
            fontSize: 11,
            fontWeight: "700",
            color: "rgba(255,255,255,0.4)",
            letterSpacing: 2,
            textTransform: "uppercase",
            marginBottom: 14,
          }}
        >
          Top Traits
        </Text>

        <View style={{ gap: 10, marginBottom: 28 }}>
          {traits.map((trait, i) => (
            <View
              key={trait}
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: [
                  "rgba(139, 80, 251, 0.25)",
                  "rgba(245, 54, 123, 0.2)",
                  "rgba(6, 182, 212, 0.2)",
                ][i],
                borderRadius: 16,
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderWidth: 1,
                borderColor: [
                  "rgba(139, 80, 251, 0.3)",
                  "rgba(245, 54, 123, 0.25)",
                  "rgba(6, 182, 212, 0.25)",
                ][i],
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  backgroundColor: [
                    "rgba(139, 80, 251, 0.3)",
                    "rgba(245, 54, 123, 0.3)",
                    "rgba(6, 182, 212, 0.3)",
                  ][i],
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 12,
                }}
              >
                <Ionicons
                  name={findTraitIcon(trait)}
                  size={18}
                  color={["#B794FF", "#FF85BD", "#67E8F9"][i]}
                />
              </View>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "700",
                  color: "#FFFFFF",
                  flex: 1,
                }}
              >
                {trait}
              </Text>
              <Text
                style={{
                  fontSize: 20,
                  color: "rgba(255,255,255,0.3)",
                }}
              >
                {["✦", "✧", "◆"][i]}
              </Text>
            </View>
          ))}
        </View>

        {/* Compatibility Score */}
        <View
          style={{
            backgroundColor: "rgba(255,255,255,0.06)",
            borderRadius: 20,
            padding: 20,
            alignItems: "center",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: "700",
              color: "rgba(255,255,255,0.4)",
              letterSpacing: 2,
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Compatibility Score
          </Text>
          {compatibilityScore != null ? (
            <View style={{ flexDirection: "row", alignItems: "baseline" }}>
              <Text style={{ fontSize: 48, fontWeight: "800", color: "#FFFFFF" }}>
                {compatibilityScore}
              </Text>
              <Text style={{ fontSize: 24, fontWeight: "700", color: "rgba(245, 54, 123, 0.9)", marginLeft: 2 }}>
                %
              </Text>
            </View>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="heart-half-outline" size={28} color="#8B50FB" />
              <Text style={{ fontSize: 20, fontWeight: "700", color: "rgba(255,255,255,0.7)" }}>
                Ready to Match
              </Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            marginTop: 24,
            gap: 6,
          }}
        >
          <Ionicons name="sparkles" size={12} color="rgba(255,255,255,0.3)" />
          <Text
            style={{
              fontSize: 11,
              fontWeight: "600",
              color: "rgba(255,255,255,0.3)",
              letterSpacing: 1,
            }}
          >
            Generated by AI • twindate.app
          </Text>
          <Ionicons name="sparkles" size={12} color="rgba(255,255,255,0.3)" />
        </View>
      </View>
    </LinearGradient>
  );
}

export default function VibeCard({ profile, compatibilityScore }: VibeCardProps) {
  const viewShotRef = useRef<ViewShot>(null);
  const [sharing, setSharing] = useState(false);
  const traits = extractTraits(profile);

  const handleShare = useCallback(async () => {
    if (!viewShotRef.current?.capture) return;
    setSharing(true);

    try {
      const uri = await viewShotRef.current.capture();
      const isAvailable = await Sharing.isAvailableAsync();

      if (!isAvailable) {
        if (Platform.OS === "web") {
          throw new Error("Sharing is not available on web.");
        }
        throw new Error("Sharing is not available on this device.");
      }

      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: "Share your Communication Card",
        UTI: "public.png",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to share";
      if (!msg.includes("cancelled") && !msg.includes("dismissed")) {
        console.warn("Share failed:", msg);
      }
    } finally {
      setSharing(false);
    }
  }, []);

  return (
    <View>
      {/* Capturable card */}
      <ViewShot
        ref={viewShotRef}
        options={{
          format: "png",
          quality: 1,
          result: "tmpfile",
        }}
        style={{
          alignSelf: "center",
          borderRadius: 28,
          overflow: "hidden",
        }}
      >
        <CardContent
          profile={profile}
          compatibilityScore={compatibilityScore}
          traits={traits}
        />
      </ViewShot>

      {/* Share button */}
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handleShare}
        disabled={sharing}
        style={{
          marginTop: 16,
          borderRadius: 20,
          overflow: "hidden",
        }}
      >
        <LinearGradient
          colors={["#6C3AE1", "#F5367B"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            paddingVertical: 16,
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "center",
            gap: 8,
            opacity: sharing ? 0.7 : 1,
          }}
        >
          {sharing ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Ionicons name="share-outline" size={20} color="#FFFFFF" />
              <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>
                Share My Vibe
              </Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}
