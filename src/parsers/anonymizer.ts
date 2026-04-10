/**
 * Replaces all real participant names in message content with aliases
 * (User A, User B, ...) before data is sent to any external API.
 */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export interface AnonymizationMap {
  [realName: string]: string;
}

export function buildAnonymizationMap(
  senders: string[],
  primaryUser: string
): AnonymizationMap {
  const map: AnonymizationMap = {};
  map[primaryUser] = "User A";

  let idx = 1;
  for (const sender of senders) {
    if (sender === primaryUser) continue;
    map[sender] = `User ${ALPHABET[idx] ?? idx + 1}`;
    idx++;
  }

  return map;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function anonymizeMessages(
  messages: string[],
  nameMap: AnonymizationMap
): string[] {
  const sortedNames = Object.keys(nameMap).sort(
    (a, b) => b.length - a.length
  );

  const pattern = new RegExp(
    sortedNames.map(escapeRegex).join("|"),
    "gi"
  );

  return messages.map((msg) =>
    msg.replace(pattern, (match) => {
      for (const [real, alias] of Object.entries(nameMap)) {
        if (match.toLowerCase() === real.toLowerCase()) return alias;
      }
      return match;
    })
  );
}

export function anonymizeSenderName(
  name: string,
  nameMap: AnonymizationMap
): string {
  return nameMap[name] ?? "User A";
}

/**
 * Build the reverse map (alias → real name) and replace all alias
 * occurrences in a string back to the real names.
 */
export function deanonymizeText(
  text: string,
  nameMap: AnonymizationMap
): string {
  const reverseMap: Record<string, string> = {};
  for (const [real, alias] of Object.entries(nameMap)) {
    reverseMap[alias] = real;
  }

  const sortedAliases = Object.keys(reverseMap).sort(
    (a, b) => b.length - a.length
  );

  if (sortedAliases.length === 0) return text;

  const pattern = new RegExp(
    sortedAliases.map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
    "gi"
  );

  return text.replace(pattern, (match) => {
    for (const [alias, real] of Object.entries(reverseMap)) {
      if (match.toLowerCase() === alias.toLowerCase()) return real;
    }
    return match;
  });
}
