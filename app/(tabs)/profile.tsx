import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  TextInput,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { COLORS } from "../../src/constants/theme";
import { saveApiKey, getApiKey, deleteApiKey } from "../../src/storage/settings";
import { loadProfile, deleteProfile } from "../../src/storage/profile";
import { revokeConsent } from "../../src/storage/consent";
import { clearMatches } from "../../src/storage/matches";
import { loadPreferences, deletePreferences } from "../../src/storage/preferences";
import { clearAccumulatedMessages, loadAccumulatedMessages } from "../../src/storage/messages";
import { clearLocalReports } from "../../src/storage/reports";
import { deleteCloudProfile } from "../../src/services/matching";
import { supabase } from "../../src/lib/supabase";
import type { PersonalityProfile, UserPreferences } from "../../src/types/chat";

interface SettingRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  hasToggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (val: boolean) => void;
  onPress?: () => void;
  danger?: boolean;
}

function SettingRow({
  icon,
  label,
  subtitle,
  hasToggle,
  toggleValue,
  onToggle,
  onPress,
  danger,
}: SettingRowProps) {
  return (
    <TouchableOpacity
      activeOpacity={hasToggle ? 1 : 0.7}
      onPress={onPress}
      className="flex-row items-center py-4 px-5"
    >
      <View
        className="w-10 h-10 rounded-xl items-center justify-center mr-4"
        style={{
          backgroundColor: danger
            ? COLORS.accent + "15"
            : COLORS.border + "60",
        }}
      >
        <Ionicons
          name={icon}
          size={20}
          color={danger ? COLORS.accent : COLORS.textSecondary}
        />
      </View>
      <View className="flex-1">
        <Text className={`text-base ${danger ? "text-accent-400" : "text-white"}`}>
          {label}
        </Text>
        {subtitle && (
          <Text className="text-xs text-dark-300 mt-0.5">{subtitle}</Text>
        )}
      </View>
      {hasToggle ? (
        <Switch
          value={toggleValue}
          onValueChange={onToggle}
          trackColor={{ false: COLORS.border, true: COLORS.primary }}
          thumbColor="#FFFFFF"
        />
      ) : (
        <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
      )}
    </TouchableOpacity>
  );
}

function PreferenceTag({ icon, label, value, color }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View className="items-center flex-1">
      <View
        className="w-10 h-10 rounded-full items-center justify-center mb-1.5"
        style={{ backgroundColor: color + "20" }}
      >
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text className="text-sm font-bold text-white">{value}</Text>
      <Text className="text-xs text-dark-300 mt-0.5">{label}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const [notificationsOn, setNotificationsOn] = useState(true);
  const [apiKey, setApiKey] = useState("");
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [profile, setProfile] = useState<PersonalityProfile | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [totalMessages, setTotalMessages] = useState(0);

  useFocusEffect(
    useCallback(() => {
      getApiKey().then((key) => {
        if (key) {
          setApiKey(key);
          setApiKeySaved(true);
        } else {
          setApiKey("");
          setApiKeySaved(false);
        }
      });
      loadProfile().then(setProfile);
      loadPreferences().then(setPreferences);
      loadAccumulatedMessages().then((msgs) => setTotalMessages(msgs.length));
    }, [])
  );

  const handleSaveKey = async () => {
    const trimmed = apiKey.trim();
    if (trimmed.length < 10) {
      Alert.alert("Invalid Key", "Enter a valid Gemini API key. Get yours at aistudio.google.com/apikey");
      return;
    }
    await saveApiKey(trimmed);
    setApiKeySaved(true);
    setShowApiKeyInput(false);
    Alert.alert("Saved", "API key stored securely on your device.");
  };

  const handleDeleteTwin = () => {
    Alert.alert(
      "Delete AI Twin",
      "This will remove your personality profile and all accumulated chat data. You can upload new chats anytime.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteProfile();
            await clearAccumulatedMessages();
            setProfile(null);
            setTotalMessages(0);
            Alert.alert("Deleted", "Your AI twin and training data have been removed.");
          },
        },
      ]
    );
  };

  const handleDeleteApiKey = () => {
    Alert.alert("Remove API Key", "Remove your stored Gemini key?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await deleteApiKey();
          setApiKey("");
          setApiKeySaved(false);
        },
      },
    ]);
  };

  const handleDeleteAllData = () => {
    Alert.alert(
      "Delete All Data",
      "This will remove your AI twin, all match results, cloud data, API key, preferences, and privacy consent. You will start completely fresh.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Everything",
          style: "destructive",
          onPress: async () => {
            // Delete from cloud (Supabase + Pinecone vector)
            try {
              await deleteCloudProfile();
            } catch {
              console.warn("Cloud deletion may have failed.");
            }

            // Delete all local data
            await deleteProfile();
            await clearMatches();
            await clearLocalReports();
            await deleteApiKey();
            await revokeConsent();
            await deletePreferences();
            await clearAccumulatedMessages();

            // Sign out from Supabase
            try {
              await supabase.auth.signOut();
            } catch {
              console.warn("Sign out failed.");
            }

            setProfile(null);
            setApiKey("");
            setApiKeySaved(false);
            setPreferences(null);
            setTotalMessages(0);
            Alert.alert("Done", "All data has been deleted. Restart the app to set up again.");
          },
        },
      ]
    );
  };

  const maskedKey = apiKeySaved
    ? `...${apiKey.slice(-6)}`
    : "Not configured";

  const genderLabel = preferences?.gender === "male" ? "Male" : preferences?.gender === "female" ? "Female" : "—";
  const interestedLabel = preferences?.interestedIn === "males" ? "Males"
    : preferences?.interestedIn === "females" ? "Females"
    : preferences?.interestedIn === "both" ? "Both"
    : "—";

  return (
    <SafeAreaView className="flex-1 bg-dark-800" edges={["top"]}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-6 pt-6 pb-2">
          <Text className="text-3xl font-bold text-white">Profile</Text>
        </View>

        {/* Profile Card */}
        <View className="mx-6 mt-4 rounded-2xl bg-dark-700 border border-dark-500 overflow-hidden">
          <View className="h-1 bg-primary-500" />
          <View className="p-6 items-center">
            <View
              className="w-24 h-24 rounded-full items-center justify-center mb-4"
              style={{
                backgroundColor: COLORS.primary + "20",
                shadowColor: COLORS.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 12,
                elevation: 6,
              }}
            >
              <Ionicons name="person" size={44} color={COLORS.primary} />
            </View>
            <Text className="text-xl font-bold text-white">Your Profile</Text>
            <Text className="text-sm text-dark-200 mt-1">
              Twin Status:{" "}
              <Text
                style={{
                  color: profile ? COLORS.success : COLORS.textMuted,
                  fontWeight: "700",
                }}
              >
                {profile ? "Active" : "Not created"}
              </Text>
            </Text>

            {profile && (
              <View className="flex-row mt-5 gap-6">
                <View className="items-center">
                  <Text className="text-lg font-bold text-primary-400">
                    {totalMessages > 0 ? totalMessages.toLocaleString() : profile.messageCount.toLocaleString()}
                  </Text>
                  <Text className="text-xs text-dark-300">Messages</Text>
                </View>
                <View className="w-px bg-dark-500" />
                <View className="items-center">
                  <Text className="text-lg font-bold text-accent-400">
                    {profile.topTopics.length}
                  </Text>
                  <Text className="text-xs text-dark-300">Topics</Text>
                </View>
                <View className="w-px bg-dark-500" />
                <View className="items-center">
                  <Text className="text-lg font-bold text-green-400">
                    {profile.primarySender}
                  </Text>
                  <Text className="text-xs text-dark-300">Twin</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* User Preferences */}
        {preferences && (
          <View className="mx-6 mt-6">
            <Text className="text-sm font-semibold text-dark-200 uppercase tracking-widest mb-3 ml-1">
              About You
            </Text>
            <View className="bg-dark-700 border border-dark-500 rounded-2xl p-5">
              <View className="flex-row">
                <PreferenceTag
                  icon="calendar-outline"
                  label="Age"
                  value={String(preferences.age)}
                  color="#F59E0B"
                />
                <View className="w-px bg-dark-500" />
                <PreferenceTag
                  icon={preferences.gender === "male" ? "male-outline" : "female-outline"}
                  label="Gender"
                  value={genderLabel}
                  color={preferences.gender === "male" ? "#3B82F6" : "#EC4899"}
                />
                <View className="w-px bg-dark-500" />
                <PreferenceTag
                  icon="heart-outline"
                  label="Interested In"
                  value={interestedLabel}
                  color={COLORS.primary}
                />
              </View>
            </View>
          </View>
        )}

        {/* Topics */}
        {profile && profile.topTopics.length > 0 && (
          <View className="mx-6 mt-6">
            <Text className="text-sm font-semibold text-dark-200 uppercase tracking-widest mb-3 ml-1">
              Detected Topics
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {profile.topTopics.map((topic) => (
                <View
                  key={topic}
                  className="bg-primary-500/10 border border-primary-500/30 rounded-full px-4 py-2"
                >
                  <Text className="text-sm text-primary-300">{topic}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* API Key */}
        <View className="mx-6 mt-6">
          <Text className="text-sm font-semibold text-dark-200 uppercase tracking-widest mb-2 ml-1">
            Gemini Configuration
          </Text>
          <View className="bg-dark-700 border border-dark-500 rounded-2xl overflow-hidden">
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setShowApiKeyInput(!showApiKeyInput)}
              className="flex-row items-center py-4 px-5"
            >
              <View className="w-10 h-10 rounded-xl bg-dark-600 items-center justify-center mr-4">
                <Ionicons name="key-outline" size={20} color={COLORS.textSecondary} />
              </View>
              <View className="flex-1">
                <Text className="text-base text-white">API Key</Text>
                <Text className="text-xs text-dark-300 mt-0.5">{maskedKey}</Text>
              </View>
              <View
                className="px-2 py-1 rounded-md"
                style={{
                  backgroundColor: apiKeySaved
                    ? COLORS.success + "20"
                    : COLORS.accent + "20",
                }}
              >
                <Text
                  className="text-xs font-bold"
                  style={{ color: apiKeySaved ? COLORS.success : COLORS.accent }}
                >
                  {apiKeySaved ? "Active" : "Required"}
                </Text>
              </View>
            </TouchableOpacity>

            {showApiKeyInput && (
              <View className="px-5 pb-4">
                <TextInput
                  value={apiKey}
                  onChangeText={setApiKey}
                  placeholder="AIza..."
                  placeholderTextColor={COLORS.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry={apiKeySaved}
                  className="bg-dark-600 border border-dark-500 rounded-xl px-4 py-3 text-white text-sm mb-3"
                />
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleSaveKey}
                    className="flex-1 bg-primary-500 rounded-xl py-3 items-center"
                  >
                    <Text className="text-white text-sm font-semibold">Save Key</Text>
                  </TouchableOpacity>
                  {apiKeySaved && (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={handleDeleteApiKey}
                      className="bg-dark-600 border border-dark-500 rounded-xl py-3 px-4 items-center"
                    >
                      <Ionicons name="trash-outline" size={16} color={COLORS.accent} />
                    </TouchableOpacity>
                  )}
                </View>
                <Text className="text-xs text-dark-300 mt-2">
                  Your key is stored locally on this device only. It is never sent to our servers.
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Settings */}
        <View className="mx-6 mt-6">
          <Text className="text-sm font-semibold text-dark-200 uppercase tracking-widest mb-2 ml-1">
            Settings
          </Text>
          <View className="bg-dark-700 border border-dark-500 rounded-2xl overflow-hidden">
            <SettingRow
              icon="notifications-outline"
              label="Notifications"
              subtitle="Match alerts and updates"
              hasToggle
              toggleValue={notificationsOn}
              onToggle={setNotificationsOn}
            />
            <View className="h-px bg-dark-600 mx-5" />
            <SettingRow
              icon="shield-checkmark-outline"
              label="Privacy & Anonymization"
              subtitle="Names replaced with User A, User B"
            />
            <View className="h-px bg-dark-600 mx-5" />
            <SettingRow
              icon="help-circle-outline"
              label="Help & Support"
            />
          </View>
        </View>

        {/* Data Status */}
        <View className="mx-6 mt-6">
          <Text className="text-sm font-semibold text-dark-200 uppercase tracking-widest mb-2 ml-1">
            Privacy Status
          </Text>
          <View className="bg-dark-700 border border-dark-500 rounded-2xl p-4">
            <View className="flex-row items-center">
              <View
                className="w-10 h-10 rounded-full items-center justify-center mr-3"
                style={{
                  backgroundColor: totalMessages === 0 ? COLORS.success + "20" : COLORS.warning + "20",
                }}
              >
                <Ionicons
                  name={totalMessages === 0 ? "shield-checkmark" : "alert-circle-outline"}
                  size={20}
                  color={totalMessages === 0 ? COLORS.success : COLORS.warning}
                />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-white">
                  Raw Data: {totalMessages === 0 ? "Purged" : `${totalMessages} messages pending`}
                </Text>
                <Text className="text-xs text-dark-300 mt-0.5">
                  {totalMessages === 0
                    ? "Only your personality summary exists"
                    : "Use \"Finalize Twin\" on Home to delete raw messages"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Danger Zone */}
        <View className="mx-6 mt-6">
          <Text className="text-sm font-semibold text-dark-200 uppercase tracking-widest mb-2 ml-1">
            Data Management
          </Text>
          <View className="bg-dark-700 border border-accent-500/20 rounded-2xl overflow-hidden">
            {profile && (
              <>
                <SettingRow
                  icon="person-remove-outline"
                  label="Delete AI Twin"
                  subtitle="Remove profile and training data"
                  danger
                  onPress={handleDeleteTwin}
                />
                <View className="h-px bg-dark-600 mx-5" />
              </>
            )}
            <SettingRow
              icon="trash-outline"
              label="Delete All Data"
              subtitle="Twin, matches, preferences, API key, and consent"
              danger
              onPress={handleDeleteAllData}
            />
          </View>
        </View>

        <Text className="text-center text-xs text-dark-400 mt-6">
          TwinDate v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
