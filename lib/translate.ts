// Multilingual translation for the chat pipeline.
//
// When `GOOGLE_TRANSLATE_API_KEY` is configured, customer messages are translated
// through the Google Cloud Translation REST API (v2). Otherwise a dedicated
// translation pass through `askAI()` (DeepSeek -> Groq -> OpenRouter) is used,
// so no new dependency is required and a single provider outage cannot break
// translation.
//
// The flow in lib/chat-engine.ts:
//   1. Detect the incoming message's language (lib/language-detect.ts).
//   2. If it is not English, translate it to English so catalogue/FAQ lookup and
//      the model's reasoning run on English text.
//   3. Generate the reply (the system prompt already instructs the model to
//      answer in the customer's detected language).
//   4. Translate the reply back into the customer's exact language.

import { askAI, type AIMessage } from "@/lib/ai";
import { debugLog } from "@/lib/logger";

export type ChatLanguage =
  | "english"
  | "pidgin"
  | "slang"
  | "mixed"
  | "yoruba"
  | "igbo"
  | "hausa"
  | "french"
  | "spanish";

/** Languages the AI can natively answer in (system prompt instructs the model). */
export const REPLY_LANGUAGES: ChatLanguage[] = [
  "yoruba",
  "igbo",
  "hausa",
  "french",
  "spanish",
  "pidgin",
  "slang",
  "mixed",
];

/** ISO 639-1 (or Google-supported) codes for the translate API. */
const LANGUAGE_CODES: Record<ChatLanguage, string> = {
  english: "en",
  pidgin: "en", // Pidgin has no Google code; treat as English for translation.
  slang: "en",
  mixed: "en",
  yoruba: "yo",
  igbo: "ig",
  hausa: "ha",
  french: "fr",
  spanish: "es",
};

function languageCode(lang: ChatLanguage): string {
  return LANGUAGE_CODES[lang] ?? "en";
}

/** Whether the message needs translation before catalogue/FAQ lookup. */
export function needsTranslation(lang: ChatLanguage): boolean {
  return lang !== "english";
}

/** Whether the model can answer directly in this language (system prompt covers it). */
export function isReplyLanguage(lang: ChatLanguage): boolean {
  return REPLY_LANGUAGES.includes(lang);
}

/**
 * Translate `text` from `sourceLanguage` to `targetLanguage`.
 * Returns the original text on any failure so the pipeline never stalls.
 */
export async function translateText(
  text: string,
  sourceLanguage: ChatLanguage,
  targetLanguage: ChatLanguage,
): Promise<string> {
  if (!text || text.trim().length === 0) return text;
  if (sourceLanguage === targetLanguage) return text;

  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (apiKey) {
    try {
      return await translateWithGoogle(text, apiKey, languageCode(sourceLanguage), languageCode(targetLanguage));
    } catch (error) {
      console.error(
        "[translate] Google Translate failed, falling back to AI translation:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  return translateWithAI(text, sourceLanguage, targetLanguage);
}

/** Translate a non-English customer message into English for catalogue lookup. */
export async function translateToEnglish(
  text: string,
  sourceLanguage: ChatLanguage,
): Promise<string> {
  if (!needsTranslation(sourceLanguage)) return text;
  return translateText(text, sourceLanguage, "english");
}

/** Translate an English reply back into the customer's language. */
export async function translateFromEnglish(
  text: string,
  targetLanguage: ChatLanguage,
): Promise<string> {
  if (!needsTranslation(targetLanguage)) return text;
  return translateText(text, "english", targetLanguage);
}

/** Google Cloud Translation REST API (v2). */
async function translateWithGoogle(
  text: string,
  apiKey: string,
  source: string,
  target: string,
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(
      "https://translation.googleapis.com/language/translate/v2",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q: text,
          source,
          target,
          format: "text",
        }),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new Error(`Google Translate HTTP ${response.status}`);
    }

    const json = await response.json();
    const translation =
      json?.data?.translations?.[0]?.translatedText ?? null;

    if (!translation) {
      throw new Error("Google Translate returned no translation");
    }

    return translation;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fallback translation through the same provider chain `askAI()` uses.
 * Tool-free and unmetered: it never touches the customer's wallet.
 */
async function translateWithAI(
  text: string,
  sourceLanguage: ChatLanguage,
  targetLanguage: ChatLanguage,
): Promise<string> {
  const source = sourceLanguage === "english" ? "English" : sourceLanguage;
  const target =
    targetLanguage === "english" ? "English" : targetLanguage;

  const messages: AIMessage[] = [
    {
      role: "system",
      content:
        `You are a professional translator. Translate the following text from ${source} to ${target}. ` +
        "Return ONLY the translated text, with no explanation, no quotation marks, and no formatting. " +
        "Preserve numbers, product names, prices and proper nouns exactly.",
    },
    { role: "user", content: text },
  ];

  try {
    const result = await askAI(messages, undefined, { temperature: 0.2 });
    const translated = result.reply.trim();
    if (translated) return translated;
  } catch (error) {
    debugLog(
      "[translate] AI translation failed:",
      error instanceof Error ? error.message : String(error),
    );
  }

  // Last resort: return the original text rather than breaking the pipeline.
  return text;
}