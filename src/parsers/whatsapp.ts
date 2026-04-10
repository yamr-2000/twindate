import { ParsedMessage, ChatParseResult } from "../types/chat";

/**
 * Strips Unicode control characters that WhatsApp embeds in exports:
 * U+200E (LRM), U+200F (RLM), U+202A-U+202E (bidi), U+FEFF (BOM), etc.
 */
function stripInvisible(text: string): string {
  return text.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff\u00a0]/g, "");
}

/**
 * Matches WhatsApp export lines across ALL known formats:
 *
 * Android formats:
 *   12/31/24, 2:05 PM - Sender: message
 *   31/12/2024, 14:05 - Sender: message
 *   12/31/24, 2:05 pm - Sender: message
 *
 * iOS formats (brackets, seconds, NO dash):
 *   [12/31/24, 2:05:30 PM] Sender: message
 *   [1/15/23, 10:15:32 AM] Sender: message
 *
 * Strategy: match timestamp first, then flexibly match the separator
 * (dash, bracket-close + space, or just space), then sender: message.
 */
const TIMESTAMP_PATTERN =
  /^\[?(\d{1,4}[\/.:-]\d{1,2}[\/.:-]\d{1,4}[,.]?\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[APap][Mm])?)\]?/;

const SYSTEM_PATTERNS = [
  /messages and calls are end-to-end encrypted/i,
  /messages are end-to-end encrypted/i,
  /created this group/i,
  /added\s+/i,
  /removed\s+/i,
  /left$/i,
  /changed the subject/i,
  /changed this group/i,
  /changed the group/i,
  /changed the description/i,
  /security code changed/i,
  /you're now an admin/i,
  /disappeared\s/i,
  /^\s*<media omitted>\s*$/i,
  /^\s*<attached:\s/i,
  /^\s*image omitted\s*$/i,
  /^\s*video omitted\s*$/i,
  /^\s*audio omitted\s*$/i,
  /^\s*sticker omitted\s*$/i,
  /^\s*document omitted\s*$/i,
  /^\s*gif omitted\s*$/i,
  /^\s*contact card omitted\s*$/i,
  /missed voice call/i,
  /missed video call/i,
  /this message was deleted/i,
  /you deleted this message/i,
  /waiting for this message/i,
];

function isSystemMessage(_sender: string, content: string): boolean {
  return SYSTEM_PATTERNS.some((pattern) => pattern.test(content));
}

/**
 * Attempts to parse a line into timestamp, sender, and content.
 * Returns null if the line is not a message start.
 */
function parseLine(
  rawLine: string
): { timestamp: string; sender: string; content: string } | null {
  const line = stripInvisible(rawLine);

  const tsMatch = line.match(TIMESTAMP_PATTERN);
  if (!tsMatch) return null;

  const timestamp = tsMatch[1];

  // Everything after the timestamp + optional closing bracket
  let rest = line.slice(tsMatch[0].length);

  // Strip the separator: " - " (Android) or just whitespace (iOS)
  rest = rest.replace(/^\s*[-–—]\s*/, "").replace(/^\s+/, "");

  // Now expect "Sender: message"
  const colonIdx = rest.indexOf(": ");
  if (colonIdx === -1 || colonIdx > 120) return null;

  const sender = rest.slice(0, colonIdx).trim();
  const content = rest.slice(colonIdx + 2).trim();

  if (!sender || sender.length > 100) return null;

  return { timestamp, sender, content };
}

function parseTimestamp(raw: string): Date {
  const cleaned = raw.replace(/[\[\]"]/g, "").trim();

  const date = new Date(cleaned);
  if (!isNaN(date.getTime())) return date;

  const match = cleaned.match(
    /(\d{1,4})[\/.\-](\d{1,2})[\/.\-](\d{1,4})[,.]?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([APap][Mm])?/
  );
  if (match) {
    const [, p1, p2, p3, hourStr, minute, , ampm] = match;

    // Determine which part is the year
    let year: number, month: number, day: number;
    const n1 = parseInt(p1, 10);
    const n3 = parseInt(p3, 10);

    if (n1 > 100) {
      // YYYY/MM/DD
      year = n1;
      month = parseInt(p2, 10);
      day = n3;
    } else if (n3 > 100 || n3 > 31) {
      // MM/DD/YYYY or DD/MM/YYYY
      year = n3 < 100 ? n3 + 2000 : n3;
      const a = n1;
      const b = parseInt(p2, 10);
      if (a > 12) {
        day = a;
        month = b;
      } else if (b > 12) {
        month = a;
        day = b;
      } else {
        month = a;
        day = b;
      }
    } else {
      // Both small: MM/DD/YY
      month = n1;
      day = parseInt(p2, 10);
      year = n3 + 2000;
    }

    let hour = parseInt(hourStr, 10);
    if (ampm) {
      const upper = ampm.toUpperCase();
      if (upper === "PM" && hour !== 12) hour += 12;
      if (upper === "AM" && hour === 12) hour = 0;
    }

    return new Date(year, month - 1, day, hour, parseInt(minute, 10));
  }

  return new Date();
}

/**
 * Parse a WhatsApp chat export. Handles multi-line messages
 * (lines without timestamps are appended to the previous message).
 */
export function parseWhatsAppChat(rawText: string): ChatParseResult {
  const lines = rawText.split(/\r?\n/);
  const messages: ParsedMessage[] = [];
  const senderSet = new Set<string>();

  let current: ParsedMessage | null = null;

  for (const line of lines) {
    const parsed = parseLine(line);
    if (parsed) {
      if (current && !isSystemMessage(current.sender, current.content)) {
        messages.push(current);
        senderSet.add(current.sender);
      }

      current = {
        timestamp: parseTimestamp(parsed.timestamp),
        sender: parsed.sender,
        content: parsed.content,
      };
    } else if (current && stripInvisible(line).trim()) {
      current.content += "\n" + stripInvisible(line).trim();
    }
  }

  if (current && !isSystemMessage(current.sender, current.content)) {
    messages.push(current);
    senderSet.add(current.sender);
  }

  const senders = Array.from(senderSet);
  const dateRange =
    messages.length >= 2
      ? { start: messages[0].timestamp, end: messages[messages.length - 1].timestamp }
      : null;

  return {
    messages,
    senders,
    totalMessages: messages.length,
    dateRange,
  };
}

/**
 * Extract a representative sample of the user's messages for analysis.
 * Evenly spaced across the conversation timeline for diversity.
 */
export function sampleUserMessages(
  messages: ParsedMessage[],
  sender: string,
  maxMessages = 150
): string[] {
  const userMessages = messages
    .filter((m) => m.sender === sender)
    .map((m) => m.content)
    .filter((c) => c.length > 1);

  if (userMessages.length <= maxMessages) return userMessages;

  const step = userMessages.length / maxMessages;
  const sampled: string[] = [];
  for (let i = 0; i < maxMessages; i++) {
    sampled.push(userMessages[Math.floor(i * step)]);
  }
  return sampled;
}
