// Adaptive language detection for customer messages.
//
// Nigerian Pidgin is a real language, not broken English. This module decides
// whether a message is English, Pidgin, or a mix of the two, so the chat route
// can mirror whatever the customer actually wrote instead of always replying in
// standard English. The business owner's tone setting is only a fallback for the
// cases this module cannot read confidently.

export type DetectedLanguage = "english" | "pidgin" | "mixed";

/**
 * Words that are strong Pidgin signals. They are not typos or misspellings, so
 * seeing several of them means the customer is writing Pidgin on purpose.
 */
export const PIDGIN_MARKERS = new Set([
  "dey", "na", "wey", "abeg", "sabi", "wahala", "chop", "don", "fit", "shey",
  "wetin", "oya", "sef", "sha", "japa", "gbedu", "make", "wan", "no", "be",
  "go", "come", "see", "hear", "talk", "small", "plenty", "bin", "kon", "waka",
  "yan", "tok", "do", "chale", "chai", "eh", "o", "se",
]);

/**
 * Common English function and content words. Used as counter-evidence: an
 * English sentence that happens to contain an ambiguous marker ("go", "see",
 * "no") should stay English, not be read as Pidgin.
 */
const ENGLISH_ONLY_WORDS = new Set([
  "the", "a", "an", "and", "is", "are", "was", "were", "this", "that",
  "these", "those", "how", "much", "many", "what", "when", "where", "which",
  "who", "why", "please", "thank", "thanks", "need", "want", "price", "cost",
  "available", "deliver", "delivery", "help", "have", "has", "had", "would",
  "could", "should", "will", "shall", "can", "may", "might", "for", "with",
  "from", "your", "you", "about", "info", "information", "good", "morning",
  "afternoon", "evening", "business", "store", "shop",
]);

/** Lowercase and split on non-alphanumeric runs, dropping empty tokens. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0);
}

/**
 * Classify `text` as English, Nigerian Pidgin, or a mix.
 *
 * The decision is a ratio of Pidgin markers against the total word count, with
 * English-only words acting as counter-evidence so ordinary English sentences
 * that contain ambiguous markers are not mistaken for Pidgin.
 */
export function detectLanguage(text: string): DetectedLanguage {
  const tokens = tokenize(text);

  if (tokens.length === 0) {
    return "english";
  }

  let pidginTokenCount = 0;
  let englishTokenCount = 0;
  const distinctMarkers = new Set<string>();

  for (const token of tokens) {
    if (PIDGIN_MARKERS.has(token)) {
      pidginTokenCount += 1;
      distinctMarkers.add(token);
    } else if (ENGLISH_ONLY_WORDS.has(token)) {
      englishTokenCount += 1;
    }
  }

  const ratio = pidginTokenCount / tokens.length;

  if (ratio >= 0.3) {
    return "pidgin";
  }

  // The middle band is only "mixed" when the Pidgin evidence is at least as
  // strong as the English evidence. A normal English sentence with two
  // ambiguous markers ("I need to go and see it") stays English.
  if (
    ratio >= 0.1 &&
    distinctMarkers.size >= 2 &&
    englishTokenCount <= pidginTokenCount
  ) {
    return "mixed";
  }

  return "english";
}

/**
 * The instruction injected at the very end of the system prompt. It comes after
 * every other rule so the model weights it most heavily, and it overrides the
 * business's tone setting.
 */
export function getLanguageInstruction(lang: DetectedLanguage): string {
  switch (lang) {
    case "pidgin":
      return "The customer is writing in Nigerian Pidgin. Reply in Nigerian Pidgin using the same style. Do not correct their grammar or convert their words to standard English.";
    case "mixed":
      return "The customer is mixing English and Nigerian Pidgin. Reply in the same mixed style. Match their tone and vocabulary.";
    case "english":
    default:
      return "The customer is writing in English. Reply in clear English.";
  }
}
