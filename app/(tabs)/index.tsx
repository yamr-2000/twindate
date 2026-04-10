import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as DocumentPicker from "expo-document-picker";

import { COLORS } from "../../src/constants/theme";
import { readChatFile } from "../../src/parsers/fileReader";
import { parseWhatsAppChat, sampleUserMessages } from "../../src/parsers/whatsapp";
import { buildAnonymizationMap, anonymizeMessages, anonymizeSenderName, deanonymizeText } from "../../src/parsers/anonymizer";
import { useRouter } from "expo-router";
import { analyzePersonality } from "../../src/services/gemini";
import { runAllSimulations } from "../../src/services/simulation";
import { sendMatchNotification } from "../../src/services/notifications";
import { useEmbedding } from "../../src/services/embedding";
import { syncProfileToCloud, findCloudMatches } from "../../src/services/matching";
import { generateDailyReport } from "../../src/services/reports";
import { saveProfile, loadProfile, deleteProfile } from "../../src/storage/profile";
import { saveMatches, loadMatches } from "../../src/storage/matches";
import { getApiKey } from "../../src/storage/settings";
import { hasConsented, saveConsent } from "../../src/storage/consent";
import { loadPreferences } from "../../src/storage/preferences";
import { loadAccumulatedMessages, saveAccumulatedMessages, clearAccumulatedMessages } from "../../src/storage/messages";
import { DIGITAL_TWINS } from "../../src/data/twins";
import BrainPulse from "../../src/components/BrainPulse";
import VibeCard from "../../src/components/VibeCard";
import type { PersonalityProfile, ChatParseResult, SimulationResult, UserPreferences, InterestedIn } from "../../src/types/chat";

type TwinStatus = "idle" | "uploading" | "parsing" | "picking_sender" | "analyzing" | "syncing" | "ready" | "matching" | "error";

interface StatusConfig {
  label: string;
  description: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  progress: number;
}

const STATUS_MAP: Record<TwinStatus, StatusConfig> = {
  idle: {
    label: "No Twin Yet",
    description: "Upload your chats to create your AI twin",
    color: COLORS.textMuted,
    icon: "cloud-upload-outline",
    progress: 0,
  },
  uploading: {
    label: "Reading File...",
    description: "Loading your chat export",
    color: COLORS.warning,
    icon: "document-text-outline",
    progress: 0.15,
  },
  parsing: {
    label: "Parsing Messages...",
    description: "Extracting conversations and filtering noise",
    color: COLORS.warning,
    icon: "code-slash-outline",
    progress: 0.3,
  },
  picking_sender: {
    label: "Who Are You?",
    description: "Select your name from the chat participants",
    color: COLORS.primaryLight,
    icon: "person-outline",
    progress: 0.45,
  },
  analyzing: {
    label: "Analyzing Personality",
    description: "AI is studying your communication style",
    color: COLORS.primaryLight,
    icon: "sparkles",
    progress: 0.7,
  },
  syncing: {
    label: "Syncing to Cloud...",
    description: "Uploading your personality vector to the cloud",
    color: COLORS.primaryLight,
    icon: "cloud-upload-outline",
    progress: 0.85,
  },
  ready: {
    label: "Twin Ready!",
    description: "Your AI twin is ready to date",
    color: COLORS.success,
    icon: "checkmark-circle",
    progress: 1,
  },
  matching: {
    label: "Simulating Dates...",
    description: "Your twin is going on dates",
    color: COLORS.primaryLight,
    icon: "heart-half-outline",
    progress: 0.85,
  },
  error: {
    label: "Something Went Wrong",
    description: "Tap below to try again",
    color: COLORS.accent,
    icon: "alert-circle-outline",
    progress: 0,
  },
};

const CONSENT_ITEMS = [
  {
    icon: "shield-checkmark" as const,
    title: "I have consent to share this data",
    description: "I confirm all participants in this chat have agreed to this analysis, or I am the sole participant.",
  },
  {
    icon: "eye-off" as const,
    title: "Names will be anonymized",
    description: "All real names are replaced with aliases (User A, User B) before any data reaches the AI.",
  },
  {
    icon: "server" as const,
    title: "Processed, not stored remotely",
    description: "Messages are sent to Gemini for one-time analysis. They are not stored on any external server.",
  },
  {
    icon: "trash" as const,
    title: "Deletable anytime",
    description: "You can delete your AI twin and all local data from the Profile screen at any time.",
  },
] as const;

function getFilteredTwins(interestedIn: InterestedIn) {
  if (interestedIn === "both") return DIGITAL_TWINS;
  const genderFilter = interestedIn === "males" ? "male" : "female";
  return DIGITAL_TWINS.filter((t) => t.gender === genderFilter);
}

export default function HomeScreen() {
  const [status, setStatus] = useState<TwinStatus>("idle");
  const [profile, setProfile] = useState<PersonalityProfile | null>(null);
  const [parseStats, setParseStats] = useState<{ total: number; senders: string[] } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [matchProgress, setMatchProgress] = useState("");
  const [consented, setConsented] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [totalAccumulated, setTotalAccumulated] = useState(0);
  const [dataBurned, setDataBurned] = useState(false);
  const [lastEmbedding, setLastEmbedding] = useState<number[] | null>(null);
  const [showVibeCard, setShowVibeCard] = useState(false);
  const [bestScore, setBestScore] = useState<number | null>(null);

  const [pendingParsed, setPendingParsed] = useState<ChatParseResult | null>(null);
  const [rememberedSender, setRememberedSender] = useState<string | null>(null);

  const router = useRouter();
  const { generate: generateEmbedding } = useEmbedding();

  const currentStatus = STATUS_MAP[status];

  useFocusEffect(
    useCallback(() => {
      loadProfile().then((saved) => {
        if (saved) {
          setProfile(saved);
          setStatus((prev) => (prev === "idle" || prev === "error" ? "ready" : prev));
          setRememberedSender(saved.primarySender);
        } else {
          setProfile(null);
          setStatus("idle");
          setRememberedSender(null);
        }
      });
      hasConsented().then(setConsented);
      loadPreferences().then(setPreferences);
      loadAccumulatedMessages().then((msgs) => {
        setTotalAccumulated(msgs.length);
        setDataBurned(msgs.length === 0);
      });
      loadMatches().then((matches) => {
        if (matches.length > 0) {
          setBestScore(Math.max(...matches.map((m) => m.compatibility)));
        }
      });
    }, [])
  );

  const handleAcceptConsent = useCallback(async () => {
    await saveConsent();
    setConsented(true);
  }, []);

  const continueWithSender = useCallback(async (selectedSender: string, parsed: ChatParseResult) => {
    try {
      setRememberedSender(selectedSender);

      const rawSample = sampleUserMessages(parsed.messages, selectedSender, 150);

      const existingMessages = await loadAccumulatedMessages();
      const existingSet = new Set(existingMessages);
      const dedupedNew = rawSample.filter((m) => !existingSet.has(m));
      const combined = [...existingMessages, ...dedupedNew];
      await saveAccumulatedMessages(combined);
      setTotalAccumulated(combined.length);

      const apiKey = await getApiKey();
      if (!apiKey) {
        throw new Error(
          "No Gemini API key found. Go to Profile \u2192 Gemini Configuration to add your key before analyzing."
        );
      }

      setStatus("analyzing");

      let analysisPool: string[];
      if (combined.length > 200) {
        const shuffled = [...combined];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        analysisPool = shuffled.slice(0, 200);
      } else {
        analysisPool = combined;
      }

      const nameMap = buildAnonymizationMap(parsed.senders, selectedSender);
      const anonymizedSample = anonymizeMessages(analysisPool, nameMap);
      const anonymizedSender = anonymizeSenderName(selectedSender, nameMap);

      const personality = await analyzePersonality(anonymizedSample, anonymizedSender);

      personality.communicationStyle = deanonymizeText(personality.communicationStyle, nameMap);
      personality.humor = deanonymizeText(personality.humor, nameMap);
      personality.emojiUsage = deanonymizeText(personality.emojiUsage, nameMap);
      personality.responsePatterns = deanonymizeText(personality.responsePatterns, nameMap);
      personality.flirtingStyle = deanonymizeText(personality.flirtingStyle, nameMap);
      personality.overallSummary = deanonymizeText(personality.overallSummary, nameMap);
      personality.topTopics = personality.topTopics.map((t) => deanonymizeText(t, nameMap));
      personality.primarySender = selectedSender;
      personality.messageCount = combined.length;

      await saveProfile(personality);
      setProfile(personality);
      setPendingParsed(null);

      // Cloud sync: generate embedding and upload to Supabase + Pinecone
      try {
        setStatus("syncing");
        const embeddingVector = await generateEmbedding(personality);
        setLastEmbedding(embeddingVector);
        await syncProfileToCloud(
          personality,
          embeddingVector,
          {
            gender: preferences?.gender ?? "unknown",
            interestedIn: preferences?.interestedIn ?? "both",
            age: preferences?.age ?? 0,
            displayName: selectedSender,
          }
        );
      } catch (syncErr) {
        const syncMsg = syncErr instanceof Error ? syncErr.message : "Unknown sync error";
        console.warn("Cloud sync skipped:", syncMsg);
        Alert.alert(
          "Cloud Sync Skipped",
          "Your personality profile was saved locally but could not be synced to the cloud. Cloud matching may use stale data until next successful sync."
        );
      }

      setStatus("ready");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      setErrorMsg(message);
      setStatus("error");
      Alert.alert("Error", message);
    }
  }, [preferences, generateEmbedding]);

  const handlePickFile = useCallback(async () => {
    if (status === "uploading" || status === "parsing" || status === "analyzing" || status === "syncing") return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "text/plain",
          "text/*",
          "application/zip",
          "application/x-zip-compressed",
          "application/octet-stream",
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      setStatus("uploading");
      setErrorMsg(null);

      const fileContent = await readChatFile(asset.uri, asset.name);

      setStatus("parsing");
      const parsed: ChatParseResult = parseWhatsAppChat(fileContent);

      if (parsed.totalMessages < 10) {
        const preview = fileContent.slice(0, 300).replace(/[^\x20-\x7E\n]/g, "?");
        throw new Error(
          `Only ${parsed.totalMessages} messages found.\n\nFirst 300 chars of file:\n${preview}`
        );
      }

      setParseStats({ total: parsed.totalMessages, senders: parsed.senders });

      if (rememberedSender && parsed.senders.includes(rememberedSender)) {
        await continueWithSender(rememberedSender, parsed);
      } else if (parsed.senders.length === 1) {
        await continueWithSender(parsed.senders[0], parsed);
      } else {
        setPendingParsed(parsed);
        setStatus("picking_sender");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred.";
      setErrorMsg(message);
      setStatus("error");
      Alert.alert("Error", message);
    }
  }, [rememberedSender, continueWithSender, status]);

  const handleSenderPicked = useCallback(async (sender: string) => {
    if (!pendingParsed) return;
    await continueWithSender(sender, pendingParsed);
  }, [pendingParsed, continueWithSender]);

  const handleStartMatching = useCallback(async () => {
    if (!profile || !preferences) return;
    try {
      setStatus("matching");
      setMatchProgress("Starting simulations...");
      setErrorMsg(null);

      let results: SimulationResult[] = [];

      // Try cloud matching first if we have an embedding
      if (lastEmbedding) {
        try {
          setMatchProgress("Searching for compatible real users...");
          results = await findCloudMatches(lastEmbedding, preferences.interestedIn);
        } catch (cloudErr) {
          console.warn("Cloud matching unavailable, falling back to local:", cloudErr);
          results = [];
        }
      }

      // Fallback to local simulation with digital twins if no cloud results
      if (results.length === 0) {
        setMatchProgress("Running local simulations...");
        const twins = getFilteredTwins(preferences.interestedIn);
        results = await runAllSimulations(
          profile,
          twins,
          (completed, total, latest) => {
            setMatchProgress(
              `Date ${completed}/${total}: ${latest.twinName} \u2014 ${latest.compatibility}%`
            );
          }
        );
      }

      await saveMatches(results);

      const successes = results.filter((r) => r.outcome === "success");
      for (const match of successes) {
        await sendMatchNotification(match);
      }

      setBestScore(Math.max(...results.map((r) => r.compatibility)));

      setMatchProgress("Generating your daily report...");
      try {
        await generateDailyReport(profile, results);
      } catch (reportErr) {
        console.warn("Report generation failed:", reportErr);
      }

      setStatus("ready");
      setMatchProgress("");

      if (successes.length > 0) {
        Alert.alert(
          `${successes.length} Match${successes.length > 1 ? "es" : ""} Found!`,
          `Your twin matched with ${successes.map((s) => s.twinName).join(", ")}. Check the Matches & Reports tabs!`,
          [
            { text: "Later", style: "cancel" },
            { text: "View Report", onPress: () => router.push("/(tabs)/reports") },
          ]
        );
      } else {
        Alert.alert(
          "Simulations Complete",
          "No strong matches this round. Check your daily report for tips!",
          [
            { text: "OK" },
            { text: "View Report", onPress: () => router.push("/(tabs)/reports") },
          ]
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Simulation failed.";
      setErrorMsg(message);
      setStatus("ready");
      Alert.alert("Simulation Error", message);
    }
  }, [profile, preferences, router, lastEmbedding]);

  const handleFinalizeTwin = useCallback(() => {
    Alert.alert(
      "Finalize Twin & Delete Raw Data",
      "This will permanently delete the raw WhatsApp messages from your device. Only your personality summary will remain (locally and in the cloud).",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Raw Data",
          style: "destructive",
          onPress: async () => {
            await clearAccumulatedMessages();
            setTotalAccumulated(0);
            setDataBurned(true);
            Alert.alert(
              "Data Purged",
              "Raw chat data has been permanently deleted. Only your personality summary is stored."
            );
          },
        },
      ]
    );
  }, []);

  const isProcessing = status === "uploading" || status === "parsing" || status === "analyzing" || status === "syncing" || status === "matching";

  return (
    <SafeAreaView className="flex-1 bg-dark-800" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="px-6 pt-6 pb-4">
          <Text className="text-3xl font-bold text-white">Home</Text>
          <Text className="text-sm text-dark-200 mt-1">
            Create and manage your AI twin
          </Text>
        </View>

        {/* Status Card */}
        <View className="mx-6 rounded-2xl bg-dark-700 border border-dark-500 overflow-hidden mb-6">
          <View className="h-1" style={{ backgroundColor: currentStatus.color }} />
          <View className="p-6">
            <View className="flex-row items-center mb-4">
              <View
                className="w-12 h-12 rounded-xl items-center justify-center mr-4"
                style={{ backgroundColor: currentStatus.color + "20" }}
              >
                <Ionicons
                  name={currentStatus.icon}
                  size={24}
                  color={currentStatus.color}
                />
              </View>
              <View className="flex-1">
                <Text className="text-lg font-semibold text-white">
                  {currentStatus.label}
                </Text>
                <Text className="text-sm text-dark-200 mt-0.5">
                  {currentStatus.description}
                </Text>
              </View>
            </View>

            {/* Progress Bar */}
            <View className="h-1.5 bg-dark-600 rounded-full overflow-hidden">
              <View
                className="h-full rounded-full"
                style={{
                  width: `${currentStatus.progress * 100}%`,
                  backgroundColor: currentStatus.color,
                }}
              />
            </View>
            <View className="flex-row justify-between mt-2">
              <Text className="text-xs text-dark-300">Upload</Text>
              <Text className="text-xs text-dark-300">Parse</Text>
              <Text className="text-xs text-dark-300">Identify</Text>
              <Text className="text-xs text-dark-300">Analyze</Text>
              <Text className="text-xs text-dark-300">Ready</Text>
            </View>

            {parseStats && isProcessing && (
              <View className="mt-3 bg-dark-600 rounded-lg p-3">
                <Text className="text-xs text-dark-100">
                  Found {parseStats.total} messages from {parseStats.senders.length} participants
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ─── PRIVACY SHIELD (shown when not consented) ─── */}
        {(status === "idle" || status === "error") && !consented && (
          <View className="mx-6">
            <View className="rounded-2xl bg-dark-700 border border-primary-500/30 overflow-hidden">
              <View className="bg-primary-500/10 px-6 py-5 items-center border-b border-primary-500/20">
                <View className="w-16 h-16 rounded-full bg-primary-500/20 items-center justify-center mb-3">
                  <Ionicons name="shield-checkmark" size={32} color={COLORS.primaryLight} />
                </View>
                <Text className="text-xl font-bold text-white">Privacy Shield</Text>
                <Text className="text-sm text-dark-200 mt-1 text-center">
                  Your data, your rules. Review before uploading.
                </Text>
              </View>

              <View className="px-5 py-4">
                {CONSENT_ITEMS.map((item, i) => (
                  <View key={i} className="flex-row mb-4">
                    <View className="w-10 h-10 rounded-xl bg-primary-500/10 items-center justify-center mr-3 mt-0.5">
                      <Ionicons name={item.icon} size={18} color={COLORS.primaryLight} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-white">{item.title}</Text>
                      <Text className="text-xs text-dark-200 mt-0.5 leading-4">
                        {item.description}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>

              <View className="px-5 pb-5">
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setConsentChecked(!consentChecked)}
                  className="flex-row items-center bg-dark-600 rounded-xl p-4 mb-4"
                >
                  <View
                    className={`w-6 h-6 rounded-md border-2 items-center justify-center mr-3 ${
                      consentChecked
                        ? "bg-primary-500 border-primary-500"
                        : "border-dark-300"
                    }`}
                  >
                    {consentChecked && (
                      <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                    )}
                  </View>
                  <Text className="text-sm text-white flex-1">
                    I confirm I have consent to share this chat data and agree to the privacy terms above.
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={consentChecked ? 0.85 : 1}
                  onPress={consentChecked ? handleAcceptConsent : undefined}
                  className={`rounded-2xl py-4 items-center ${
                    consentChecked ? "bg-primary-500" : "bg-dark-500"
                  }`}
                >
                  <View className="flex-row items-center">
                    <Ionicons
                      name="shield-checkmark"
                      size={18}
                      color={consentChecked ? "#FFFFFF" : COLORS.textMuted}
                    />
                    <Text
                      className={`text-base font-bold ml-2 ${
                        consentChecked ? "text-white" : "text-dark-300"
                      }`}
                    >
                      Accept & Continue
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* ─── UPLOAD SECTION (shown after consent, when idle or error) ─── */}
        {(status === "idle" || status === "error") && consented && (
          <View className="mx-6">
            <Text className="text-sm font-semibold text-dark-200 uppercase tracking-widest mb-4 ml-1">
              Upload Chat Log
            </Text>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handlePickFile}
              className="border-2 border-dashed border-primary-500/40 rounded-2xl py-10 items-center bg-primary-500/5"
            >
              <View className="w-16 h-16 rounded-full bg-primary-500/15 items-center justify-center mb-4">
                <Ionicons
                  name="cloud-upload-outline"
                  size={32}
                  color={COLORS.primaryLight}
                />
              </View>
              <Text className="text-base font-semibold text-white">
                Tap to Upload WhatsApp Export
              </Text>
              <Text className="text-sm text-dark-200 mt-1">
                .txt or .zip (iPhone) supported
              </Text>
              <View className="flex-row items-center mt-3 bg-primary-500/10 rounded-full px-3 py-1">
                <Ionicons name="shield-checkmark-outline" size={12} color={COLORS.primaryLight} />
                <Text className="text-xs text-primary-300 ml-1">Names anonymized before AI analysis</Text>
              </View>
            </TouchableOpacity>

            {errorMsg && (
              <View className="mt-4 bg-accent-500/10 border border-accent-500/30 rounded-xl p-4">
                <Text className="text-sm text-accent-300">{errorMsg}</Text>
              </View>
            )}

            <View className="mt-6 bg-dark-700 border border-dark-500 rounded-2xl p-5">
              <Text className="text-sm font-semibold text-white mb-3">
                How to export from WhatsApp
              </Text>
              {[
                "Open any WhatsApp chat",
                "Tap \u22ee (Android) or the contact name (iPhone)",
                "Select Export Chat \u2192 Without Media",
                "Upload the .txt or .zip file here",
              ].map((step, i) => (
                <View key={i} className="flex-row items-start mb-2">
                  <Text className="text-xs text-primary-400 font-bold mr-3 mt-0.5">
                    {i + 1}.
                  </Text>
                  <Text className="text-sm text-dark-200 flex-1">{step}</Text>
                </View>
              ))}
            </View>

            <View className="mt-4">
              <Text className="text-xs text-dark-300 mb-3 ml-1">
                Supported platforms
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {[
                  { name: "WhatsApp", supported: true },
                  { name: "Telegram", supported: false },
                  { name: "iMessage", supported: false },
                  { name: "Instagram", supported: false },
                ].map((p) => (
                  <View
                    key={p.name}
                    className={`border rounded-full px-4 py-2 ${
                      p.supported
                        ? "bg-primary-500/10 border-primary-500/30"
                        : "bg-dark-700 border-dark-500"
                    }`}
                  >
                    <Text
                      className={`text-xs ${
                        p.supported ? "text-primary-300" : "text-dark-300"
                      }`}
                    >
                      {p.name} {p.supported ? "\u2713" : "(soon)"}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* ─── SENDER PICKER ─── */}
        {status === "picking_sender" && pendingParsed && (
          <View className="mx-6">
            <View className="rounded-2xl bg-dark-700 border border-primary-500/30 overflow-hidden">
              <View className="bg-primary-500/10 px-6 py-5 items-center border-b border-primary-500/20">
                <View className="w-16 h-16 rounded-full bg-primary-500/20 items-center justify-center mb-3">
                  <Ionicons name="person-circle-outline" size={36} color={COLORS.primaryLight} />
                </View>
                <Text className="text-xl font-bold text-white">Which one is you?</Text>
                <Text className="text-sm text-dark-200 mt-1 text-center">
                  We found {pendingParsed.senders.length} people in this chat. Tap your name so we analyze the right person.
                </Text>
              </View>

              <View className="p-4">
                {pendingParsed.senders.map((sender) => {
                  const count = pendingParsed.messages.filter((m) => m.sender === sender).length;
                  return (
                    <TouchableOpacity
                      key={sender}
                      activeOpacity={0.8}
                      onPress={() => handleSenderPicked(sender)}
                      className="flex-row items-center bg-dark-600 rounded-xl p-4 mb-3 border border-dark-500"
                    >
                      <View className="w-12 h-12 rounded-full bg-primary-500/20 items-center justify-center mr-4">
                        <Text className="text-lg font-bold text-primary-400">
                          {sender.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-base font-semibold text-white">{sender}</Text>
                        <Text className="text-xs text-dark-300 mt-0.5">
                          {count} messages in this chat
                        </Text>
                      </View>
                      <Ionicons name="arrow-forward-circle" size={24} color={COLORS.primaryLight} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* ─── PROCESSING STATES with Brain Pulse ─── */}
        {isProcessing && (
          <View className="mx-6 items-center py-4">
            <BrainPulse
              size={80}
              color={
                status === "matching" ? COLORS.accent
                : status === "analyzing" ? COLORS.primaryLight
                : COLORS.warning
              }
              active
            />
            <Text className="text-xl font-bold text-white mt-2">
              {currentStatus.label}
            </Text>
            <Text className="text-sm text-dark-200 mt-2 text-center px-8 leading-5">
              {status === "uploading" && "Reading file contents (extracting zip if needed)..."}
              {status === "parsing" && "Extracting messages, filtering system noise, identifying participants..."}
              {status === "analyzing" && "AI is building your personality profile \u2014 humor, style, topics, and more..."}
              {status === "syncing" && "Generating your personality vector and syncing to the cloud..."}
              {status === "matching" && (matchProgress || "Preparing date simulations...")}
            </Text>
            {status === "analyzing" && totalAccumulated > 0 && (
              <View className="flex-row items-center mt-3 bg-dark-700 rounded-full px-4 py-2">
                <Ionicons name="layers-outline" size={14} color={COLORS.primaryLight} />
                <Text className="text-xs text-primary-300 ml-2">
                  Training on {totalAccumulated} total messages
                </Text>
              </View>
            )}
            {status === "analyzing" && (
              <View className="flex-row items-center mt-2 bg-primary-500/10 rounded-full px-4 py-2">
                <Ionicons name="eye-off-outline" size={14} color={COLORS.primaryLight} />
                <Text className="text-xs text-primary-300 ml-2">
                  Real names anonymized during analysis
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ─── READY STATE ─── */}
        {status === "ready" && profile && (
          <View className="mx-6">
            <Text className="text-sm font-semibold text-dark-200 uppercase tracking-widest mb-4 ml-1">
              Your AI Twin
            </Text>

            {/* Summary Card */}
            <View className="rounded-2xl bg-dark-700 border border-dark-500 overflow-hidden mb-4">
              <View className="h-1 bg-green-500" />
              <View className="p-6 items-center">
                <View className="w-20 h-20 rounded-full bg-primary-500/20 items-center justify-center mb-4">
                  <Ionicons name="person" size={36} color={COLORS.primary} />
                </View>
                <Text className="text-lg font-bold text-white">
                  {profile.primarySender}{"'"}s Twin
                </Text>
                <Text className="text-sm text-dark-200 mt-1">
                  Trained on {profile.messageCount} messages
                </Text>
                <Text className="text-xs text-dark-300 mt-1">
                  Last updated {new Date(profile.analyzedAt).toLocaleDateString()}
                </Text>
                {totalAccumulated > profile.messageCount && (
                  <View className="flex-row items-center mt-2 bg-primary-500/10 rounded-full px-3 py-1">
                    <Ionicons name="layers-outline" size={12} color={COLORS.primaryLight} />
                    <Text className="text-xs text-primary-300 ml-1">
                      {totalAccumulated} messages in training pool
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Personality Overview */}
            <View className="rounded-2xl bg-dark-700 border border-dark-500 p-5 mb-4">
              <Text className="text-sm font-semibold text-white mb-3">
                Personality Overview
              </Text>
              <Text className="text-sm text-dark-100 leading-5">
                {profile.overallSummary}
              </Text>
            </View>

            {/* Trait Cards */}
            {([
              { label: "Communication Style", value: profile.communicationStyle, icon: "chatbubble-outline" as const, color: "#8B50FB" },
              { label: "Humor", value: profile.humor, icon: "happy-outline" as const, color: "#F59E0B" },
              { label: "Emoji Usage", value: profile.emojiUsage, icon: "heart-outline" as const, color: "#F5367B" },
              { label: "Response Patterns", value: profile.responsePatterns, icon: "time-outline" as const, color: "#10B981" },
              { label: "Flirting Style", value: profile.flirtingStyle, icon: "flame-outline" as const, color: "#06B6D4" },
            ]).map((trait) => (
              <View
                key={trait.label}
                className="rounded-xl bg-dark-700 border border-dark-500 overflow-hidden mb-3"
              >
                <View className="h-0.5" style={{ backgroundColor: trait.color }} />
                <View className="p-4">
                  <View className="flex-row items-center mb-2">
                    <View
                      className="w-7 h-7 rounded-lg items-center justify-center mr-2"
                      style={{ backgroundColor: trait.color + "20" }}
                    >
                      <Ionicons name={trait.icon} size={14} color={trait.color} />
                    </View>
                    <Text className="text-xs font-bold uppercase tracking-wide" style={{ color: trait.color }}>
                      {trait.label}
                    </Text>
                  </View>
                  <Text className="text-sm text-dark-100 leading-5">
                    {trait.value}
                  </Text>
                </View>
              </View>
            ))}

            {/* Top Topics */}
            {profile.topTopics.length > 0 && (
              <View className="mb-4">
                <Text className="text-xs font-bold text-dark-200 uppercase tracking-wide mb-2 ml-1">
                  Top Topics
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {profile.topTopics.map((topic) => (
                    <View
                      key={topic}
                      className="bg-primary-500/10 border border-primary-500/30 rounded-full px-4 py-2"
                    >
                      <Text className="text-xs text-primary-300">{topic}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Communication Card / VibeCard */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setShowVibeCard(!showVibeCard)}
              className="mb-4 rounded-2xl border overflow-hidden"
              style={{
                borderColor: showVibeCard ? "rgba(108,58,225,0.4)" : "rgba(42,42,74,1)",
                backgroundColor: showVibeCard ? "rgba(108,58,225,0.06)" : "#1E1E3A",
              }}
            >
              <View className="p-4 flex-row items-center">
                <View
                  className="w-10 h-10 rounded-xl items-center justify-center mr-3"
                  style={{ backgroundColor: "rgba(139,80,251,0.15)" }}
                >
                  <Ionicons name="sparkles" size={20} color="#8B50FB" />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-white">
                    Communication Card
                  </Text>
                  <Text className="text-xs text-dark-300 mt-0.5">
                    Your Spotify Wrapped-style vibe card
                  </Text>
                </View>
                <Ionicons
                  name={showVibeCard ? "chevron-up" : "chevron-down"}
                  size={20}
                  color="#75758E"
                />
              </View>
            </TouchableOpacity>

            {showVibeCard && (
              <View className="mb-4">
                <VibeCard
                  profile={profile}
                  compatibilityScore={bestScore}
                />
              </View>
            )}

            {/* Privacy Badge */}
            {dataBurned ? (
              <View className="flex-row items-center bg-green-500/10 border border-green-500/30 rounded-xl p-3 mb-4">
                <Ionicons name="shield-checkmark" size={18} color={COLORS.success} />
                <Text className="text-xs text-green-400 ml-2 flex-1">
                  Raw chats deleted — only your personality summary exists
                </Text>
              </View>
            ) : totalAccumulated > 0 ? (
              <View className="flex-row items-center bg-warning-500/10 border border-warning-500/30 rounded-xl p-3 mb-4"
                style={{ backgroundColor: COLORS.warning + "10", borderColor: COLORS.warning + "30" }}
              >
                <Ionicons name="alert-circle-outline" size={18} color={COLORS.warning} />
                <Text className="text-xs ml-2 flex-1" style={{ color: COLORS.warning }}>
                  {totalAccumulated} raw messages still on device
                </Text>
              </View>
            ) : null}

            {/* Actions */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleStartMatching}
              className="bg-primary-500 rounded-2xl py-4 items-center mb-3"
              style={{
                shadowColor: COLORS.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.4,
                shadowRadius: 12,
                elevation: 8,
              }}
            >
              <View className="flex-row items-center">
                <Ionicons name="heart" size={18} color="#FFFFFF" />
                <Text className="text-white text-base font-bold ml-2">
                  Start Matching
                </Text>
              </View>
            </TouchableOpacity>

            {/* Burn After Reading / Upload More */}
            {!dataBurned && totalAccumulated > 0 ? (
              <View className="flex-row gap-3 mb-3">
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handlePickFile}
                  className="flex-1 border border-primary-500/40 bg-primary-500/5 rounded-2xl py-4 items-center"
                >
                  <View className="flex-row items-center">
                    <Ionicons name="add-circle-outline" size={16} color={COLORS.primaryLight} />
                    <Text className="text-primary-300 text-sm font-semibold ml-1.5">
                      Upload More
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleFinalizeTwin}
                  className="flex-1 border border-green-500/40 bg-green-500/5 rounded-2xl py-4 items-center"
                >
                  <View className="flex-row items-center">
                    <Ionicons name="flame-outline" size={16} color={COLORS.success} />
                    <Text className="text-green-400 text-sm font-semibold ml-1.5">
                      Finalize Twin
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            ) : dataBurned ? (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  Alert.alert(
                    "Start Fresh",
                    "This will delete your current twin and let you re-upload chats.",
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Start Fresh",
                        style: "destructive",
                        onPress: async () => {
                          await deleteProfile();
                          setProfile(null);
                          setStatus("idle");
                          setDataBurned(false);
                          setLastEmbedding(null);
                        },
                      },
                    ]
                  );
                }}
                className="border border-dark-500 bg-dark-700 rounded-2xl py-4 items-center"
              >
                <View className="flex-row items-center">
                  <Ionicons name="refresh-outline" size={18} color={COLORS.textSecondary} />
                  <Text className="text-dark-200 text-base font-semibold ml-2">
                    Start Fresh
                  </Text>
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handlePickFile}
                className="border border-primary-500/40 bg-primary-500/5 rounded-2xl py-4 items-center"
              >
                <View className="flex-row items-center">
                  <Ionicons name="add-circle-outline" size={18} color={COLORS.primaryLight} />
                  <Text className="text-primary-300 text-base font-semibold ml-2">
                    Upload More Chats
                  </Text>
                </View>
                <Text className="text-xs text-dark-300 mt-1">
                  More data = smarter twin
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
