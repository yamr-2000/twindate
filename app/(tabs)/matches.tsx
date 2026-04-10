import React, { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { COLORS } from "../../src/constants/theme";
import { loadMatches } from "../../src/storage/matches";
import type { SimulationResult } from "../../src/types/chat";

function CompatibilityBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? COLORS.success
      : score >= 60
        ? COLORS.primaryLight
        : score >= 40
          ? COLORS.warning
          : COLORS.textMuted;

  return (
    <View
      className="px-3 py-1 rounded-full"
      style={{ backgroundColor: color + "20" }}
    >
      <Text className="text-xs font-bold" style={{ color }}>
        {score}%
      </Text>
    </View>
  );
}

function OutcomeBadge({ outcome }: { outcome: SimulationResult["outcome"] }) {
  const config = {
    success: { label: "Match!", color: COLORS.success, icon: "heart" as const },
    neutral: { label: "Friendly", color: COLORS.warning, icon: "chatbubble-ellipses-outline" as const },
    no_spark: { label: "No Spark", color: COLORS.textMuted, icon: "close-circle-outline" as const },
  }[outcome];

  return (
    <View className="flex-row items-center gap-1 mt-1">
      <Ionicons name={config.icon} size={12} color={config.color} />
      <Text className="text-xs font-semibold" style={{ color: config.color }}>
        {config.label}
      </Text>
    </View>
  );
}

function MatchCard({
  result,
  expanded,
  onToggle,
}: {
  result: SimulationResult;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isSuccess = result.outcome === "success";

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onToggle}
      className="mx-6 mb-4 rounded-2xl border overflow-hidden"
      style={{
        backgroundColor: isSuccess ? "rgba(108,58,225,0.06)" : COLORS.darkSurface,
        borderColor: isSuccess ? "rgba(108,58,225,0.25)" : COLORS.border,
      }}
    >
      {/* Colored accent bar */}
      <View
        className="h-0.5"
        style={{
          backgroundColor: isSuccess ? COLORS.success : result.avatarColor,
        }}
      />

      <View className="p-5">
        <View className="flex-row items-center mb-3">
          <View
            className="w-12 h-12 rounded-full items-center justify-center mr-3"
            style={{ backgroundColor: result.avatarColor + "20" }}
          >
            <Ionicons name="person" size={22} color={result.avatarColor} />
          </View>
          <View className="flex-1">
            <Text className="text-base font-semibold text-white">
              {result.twinName}
            </Text>
            <OutcomeBadge outcome={result.outcome} />
          </View>
          <CompatibilityBadge score={result.compatibility} />
        </View>

        {result.traits.length > 0 && (
          <View className="flex-row flex-wrap gap-1 mb-3">
            {result.traits.map((trait) => (
              <View
                key={trait}
                className="rounded-full px-3 py-1"
                style={{ backgroundColor: result.avatarColor + "15" }}
              >
                <Text className="text-xs text-dark-100">{trait}</Text>
              </View>
            ))}
          </View>
        )}

        <View className="bg-dark-700 rounded-xl p-3 mb-2">
          <Text className="text-xs font-bold text-primary-400 uppercase tracking-wide mb-1">
            {isSuccess ? "Why You Match" : "AI Analysis"}
          </Text>
          <Text className="text-sm text-dark-100 leading-5">
            {result.whyGoodFit}
          </Text>
        </View>

        {expanded && result.conversationHighlight && (
          <View className="bg-dark-700 rounded-xl p-3 mt-2">
            <Text className="text-xs font-bold text-accent-400 uppercase tracking-wide mb-2">
              Conversation Highlight
            </Text>
            {result.conversationHighlight.split("|").map((line, i) => (
              <Text key={i} className="text-sm text-dark-100 leading-5 mb-1">
                {line.trim()}
              </Text>
            ))}
          </View>
        )}

        <View className="flex-row items-center justify-between mt-2">
          <Text className="text-xs text-dark-300">
            {new Date(result.simulatedAt).toLocaleDateString()}
          </Text>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={16}
            color={COLORS.textMuted}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function StatCard({
  value,
  label,
  color,
}: {
  value: string;
  label: string;
  color: string;
}) {
  return (
    <View className="flex-1 bg-dark-700 border border-dark-500 rounded-xl overflow-hidden">
      <View className="h-0.5" style={{ backgroundColor: color }} />
      <View className="p-4 items-center">
        <Text className="text-2xl font-bold" style={{ color }}>
          {value}
        </Text>
        <Text className="text-xs text-dark-300 mt-1">{label}</Text>
      </View>
    </View>
  );
}

export default function MatchesScreen() {
  const [results, setResults] = useState<SimulationResult[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadMatches().then(setResults);
    }, [])
  );

  const successCount = results.filter((r) => r.outcome === "success").length;
  const bestScore = results.length > 0 ? Math.max(...results.map((r) => r.compatibility)) : 0;

  return (
    <SafeAreaView className="flex-1 bg-dark-800" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-6 pt-6 pb-2">
          <Text className="text-3xl font-bold text-white">Matches</Text>
          <Text className="text-sm text-dark-200 mt-1">
            Simulated date results from your AI twin
          </Text>
        </View>

        <View className="flex-row mx-6 my-4 gap-3">
          <StatCard
            value={String(successCount)}
            label="Matches"
            color={COLORS.primary}
          />
          <StatCard
            value={String(results.length)}
            label="Dates Simulated"
            color={COLORS.accent}
          />
          <StatCard
            value={bestScore > 0 ? `${bestScore}%` : "\u2014"}
            label="Best Match"
            color={COLORS.success}
          />
        </View>

        {results.length === 0 ? (
          <View className="mx-6 mt-8 items-center">
            <View className="w-24 h-24 rounded-full bg-dark-700 border border-dark-500 items-center justify-center mb-4">
              <Ionicons name="heart-half-outline" size={44} color={COLORS.border} />
            </View>
            <Text className="text-lg font-semibold text-dark-300 mt-2">
              No Simulations Yet
            </Text>
            <Text className="text-sm text-dark-400 mt-2 text-center px-8 leading-5">
              Upload your chats and tap "Start Matching" on the Home screen to run AI date simulations.
            </Text>
          </View>
        ) : (
          <View className="mt-2">
            {successCount > 0 && (
              <>
                <Text className="text-sm font-semibold text-dark-200 uppercase tracking-widest mb-4 mx-7">
                  Successful Matches
                </Text>
                {results
                  .filter((r) => r.outcome === "success")
                  .map((r) => (
                    <MatchCard
                      key={r.id}
                      result={r}
                      expanded={expandedId === r.id}
                      onToggle={() =>
                        setExpandedId(expandedId === r.id ? null : r.id)
                      }
                    />
                  ))}
              </>
            )}

            {results.some((r) => r.outcome !== "success") && (
              <>
                <Text className="text-sm font-semibold text-dark-200 uppercase tracking-widest mb-4 mx-7 mt-2">
                  Other Results
                </Text>
                {results
                  .filter((r) => r.outcome !== "success")
                  .map((r) => (
                    <MatchCard
                      key={r.id}
                      result={r}
                      expanded={expandedId === r.id}
                      onToggle={() =>
                        setExpandedId(expandedId === r.id ? null : r.id)
                      }
                    />
                  ))}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
