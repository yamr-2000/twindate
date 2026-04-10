import { File } from "expo-file-system";
import JSZip from "jszip";

/**
 * Reads a chat file and returns its text content.
 * Handles both plain .txt files and .zip archives (iOS WhatsApp exports).
 * For zips, extracts the first .txt file inside.
 */
export async function readChatFile(uri: string, fileName: string): Promise<string> {
  const isZip =
    fileName.toLowerCase().endsWith(".zip") ||
    uri.toLowerCase().endsWith(".zip");

  if (isZip) {
    return extractTextFromZip(uri);
  }

  const file = new File(uri);
  const content = file.text();

  if (!content || content.length < 50) {
    throw new Error("File appears empty or too small to be a chat log.");
  }

  return content;
}

async function extractTextFromZip(uri: string): Promise<string> {
  const file = new File(uri);
  const bytes = await file.bytes();

  const zip = await JSZip.loadAsync(bytes);
  const txtFiles = Object.keys(zip.files).filter(
    (name) =>
      name.toLowerCase().endsWith(".txt") && !zip.files[name].dir
  );

  if (txtFiles.length === 0) {
    throw new Error(
      "No .txt file found inside the zip. Make sure you export from WhatsApp with 'Without Media'."
    );
  }

  // WhatsApp iOS typically names it _chat.txt or WhatsApp Chat - Name.txt
  const chatFile =
    txtFiles.find((n) => n.toLowerCase().includes("chat")) ?? txtFiles[0];

  const content = await zip.files[chatFile].async("string");

  if (!content || content.length < 50) {
    throw new Error("The chat file inside the zip appears empty or too small.");
  }

  return content;
}
