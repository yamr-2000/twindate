import React, { useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { COLORS } from "../../src/constants/theme";
import { loadAllReports } from "../../src/services/reports";
import type { DailyReport } from "../../src/types/chat";

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";

  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function InsightCard({ report }: { report: DailyReport }) {
  return (
    <View
      style={{
        borderRadius: 20,
        overflow: "hidden",
        marginBottom: 16,
      }}
    >
      <LinearGradient
        colors={["#1E1E3A", "#16162D"]}
        style={{ borderRadius: 20, borderWidth: 1, borderColor: COLORS.border }}
      >
        {/* Top accent */}
        <LinearGradient
          colors={["#6C3AE1", "#F5367B"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ height: 3 }}
        />

        <View style={{ padding: 20 }}>
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: "rgba(108, 58, 225, 0.15)",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 12,
              }}
            >
              <Ionicons name="analytics-outline" size={20} color={COLORS.primaryLight} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF" }}>
                {formatDate(report.date)}
              </Text>
              <Text style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>
                {report.date}
              </Text>
            </View>
            {report.matchCount > 0 && (
              <View
                style={{
                  backgroundColor: "rgba(16, 185, 129, 0.15)",
                  borderRadius: 12,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: "700", color: COLORS.success }}>
                  {report.matchCount} match{report.matchCount !== 1 ? "es" : ""}
                </Text>
              </View>
            )}
          </View>

          {/* Summary sentence */}
          <View
            style={{
              backgroundColor: "rgba(108, 58, 225, 0.08)",
              borderRadius: 16,
              padding: 16,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: "rgba(108, 58, 225, 0.15)",
            }}
          >
            <Text style={{ fontSize: 15, color: "#FFFFFF", lineHeight: 22, fontWeight: "500" }}>
              Your AI Twin spoke to{" "}
              <Text style={{ color: COLORS.primaryLight, fontWeight: "800" }}>
                {report.peopleCount} {report.peopleCount === 1 ? "person" : "people"}
              </Text>
              {" "}today.
            </Text>
            {report.vibeTraits.length > 0 && (
              <Text style={{ fontSize: 15, color: "#FFFFFF", lineHeight: 22, marginTop: 6, fontWeight: "500" }}>
                It found you vibe best with people who are{" "}
                <Text style={{ color: COLORS.accent, fontWeight: "800" }}>
                  {report.vibeTraits.join(", ")}
                </Text>
                .
              </Text>
            )}
          </View>

          {/* Best Match */}
          {report.bestMatchName && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 16,
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: "rgba(245, 54, 123, 0.12)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="trophy-outline" size={20} color={COLORS.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: COLORS.textMuted, fontWeight: "600" }}>
                  BEST MATCH
                </Text>
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#FFFFFF", marginTop: 2 }}>
                  {report.bestMatchName}
                </Text>
              </View>
              {report.bestMatchScore != null && (
                <View
                  style={{
                    backgroundColor: "rgba(245, 54, 123, 0.12)",
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                  }}
                >
                  <Text style={{ fontSize: 18, fontWeight: "800", color: COLORS.accent }}>
                    {report.bestMatchScore}%
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Vibe Trait Badges */}
          {report.vibeTraits.length > 0 && (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {report.vibeTraits.map((trait, i) => (
                <View
                  key={trait}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: [
                      "rgba(139, 80, 251, 0.12)",
                      "rgba(245, 54, 123, 0.10)",
                      "rgba(6, 182, 212, 0.10)",
                    ][i % 3],
                    borderRadius: 20,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderWidth: 1,
                    borderColor: [
                      "rgba(139, 80, 251, 0.2)",
                      "rgba(245, 54, 123, 0.15)",
                      "rgba(6, 182, 212, 0.15)",
                    ][i % 3],
                    gap: 6,
                  }}
                >
                  <Ionicons
                    name={
                      (["sparkles", "heart", "flash"] as const)[i % 3]
                    }
                    size={12}
                    color={["#B794FF", "#FF85BD", "#67E8F9"][i % 3]}
                  />
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "600",
                      color: ["#B794FF", "#FF85BD", "#67E8F9"][i % 3],
                    }}
                  >
                    {trait}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Daily Insight */}
          <View
            style={{
              backgroundColor: "rgba(249, 168, 37, 0.06)",
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: "rgba(249, 168, 37, 0.12)",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 8 }}>
              <Ionicons name="bulb-outline" size={16} color={COLORS.warning} />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: COLORS.warning,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                }}
              >
                Daily Insight
              </Text>
            </View>
            <Text style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", lineHeight: 21 }}>
              {report.dailyInsight}
            </Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

function StatPill({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: color + "10",
        borderRadius: 16,
        padding: 16,
        alignItems: "center",
        borderWidth: 1,
        borderColor: color + "20",
      }}
    >
      <Text style={{ fontSize: 24, fontWeight: "800", color }}>{value}</Text>
      <Text style={{ fontSize: 11, color: COLORS.textMuted, marginTop: 4, fontWeight: "600" }}>
        {label}
      </Text>
    </View>
  );
}

export default function ReportsScreen() {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadAllReports()
        .then(setReports)
        .finally(() => setLoading(false));
    }, [])
  );

  const totalDates = reports.reduce((sum, r) => sum + r.peopleCount, 0);
  const totalMatches = reports.reduce((sum, r) => sum + r.matchCount, 0);
  const avgScore =
    reports.length > 0
      ? Math.round(
          reports
            .filter((r) => r.bestMatchScore != null)
            .reduce((s, r) => s + (r.bestMatchScore ?? 0), 0) /
            Math.max(1, reports.filter((r) => r.bestMatchScore != null).length)
        )
      : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0E0E20" }} edges={["top"]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 8 }}>
          <Text style={{ fontSize: 30, fontWeight: "800", color: "#FFFFFF" }}>
            Reports
          </Text>
          <Text style={{ fontSize: 14, color: COLORS.textMuted, marginTop: 4 }}>
            Your AI Twin's dating history
          </Text>
        </View>

        {/* Aggregate Stats */}
        {reports.length > 0 && (
          <View
            style={{
              flexDirection: "row",
              marginHorizontal: 24,
              marginTop: 16,
              marginBottom: 8,
              gap: 10,
            }}
          >
            <StatPill value={String(totalDates)} label="Total Dates" color={COLORS.primary} />
            <StatPill value={String(totalMatches)} label="Matches" color={COLORS.accent} />
            <StatPill
              value={avgScore > 0 ? `${avgScore}%` : "\u2014"}
              label="Avg Best"
              color={COLORS.success}
            />
          </View>
        )}

        {/* Report List */}
        <View style={{ paddingHorizontal: 24, marginTop: 20 }}>
          {loading ? (
            <View style={{ alignItems: "center", paddingTop: 60 }}>
              <Text style={{ color: COLORS.textMuted, fontSize: 14 }}>Loading reports...</Text>
            </View>
          ) : reports.length === 0 ? (
            <View style={{ alignItems: "center", paddingTop: 60 }}>
              <View
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: 48,
                  backgroundColor: COLORS.darkCard,
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 20,
                }}
              >
                <Ionicons name="document-text-outline" size={44} color={COLORS.border} />
              </View>
              <Text style={{ fontSize: 18, fontWeight: "700", color: COLORS.textMuted }}>
                No Reports Yet
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: COLORS.textMuted,
                  marginTop: 8,
                  textAlign: "center",
                  paddingHorizontal: 32,
                  lineHeight: 20,
                }}
              >
                Run "Start Matching" on the Home screen. After each session, your AI Twin will
                generate a daily match report with personalized insights.
              </Text>
            </View>
          ) : (
            <>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: COLORS.textMuted,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  marginBottom: 16,
                  marginLeft: 2,
                }}
              >
                Dating History
              </Text>
              {reports.map((report) => (
                <InsightCard key={report.id} report={report} />
              ))}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
