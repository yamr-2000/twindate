export interface ParsedMessage {
  timestamp: Date;
  sender: string;
  content: string;
}

export interface ChatParseResult {
  messages: ParsedMessage[];
  senders: string[];
  totalMessages: number;
  dateRange: {
    start: Date;
    end: Date;
  } | null;
}

export interface PersonalityProfile {
  communicationStyle: string;
  humor: string;
  emojiUsage: string;
  responsePatterns: string;
  flirtingStyle: string;
  topTopics: string[];
  overallSummary: string;
  analyzedAt: string;
  messageCount: number;
  primarySender: string;
}

export type Gender = "male" | "female";
export type InterestedIn = "males" | "females" | "both";

export interface UserPreferences {
  age: number;
  gender: Gender;
  interestedIn: InterestedIn;
}

export interface DigitalTwin {
  id: string;
  name: string;
  age: number;
  gender: Gender;
  avatarColor: string;
  personality: PersonalityProfile;
}

export interface SimulationResult {
  id: string;
  twinId: string;
  twinName: string;
  avatarColor: string;
  compatibility: number;
  outcome: "success" | "neutral" | "no_spark";
  whyGoodFit: string;
  conversationHighlight: string;
  traits: string[];
  simulatedAt: string;
}

export interface DailyReport {
  id: string;
  date: string;
  peopleCount: number;
  matchCount: number;
  bestMatchName: string | null;
  bestMatchScore: number | null;
  vibeTraits: string[];
  dailyInsight: string;
  createdAt: string;
}

