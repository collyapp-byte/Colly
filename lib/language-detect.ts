// Adaptive language detection for customer messages.
//
// Nigerian Pidgin is a real language, not broken English. This module decides
// whether a message is English, Pidgin, or a mix of the two, so the chat route
// can mirror whatever the customer actually wrote instead of always replying in
// standard English. The business owner's tone setting is only a fallback for the
// cases this module cannot read confidently.

export type DetectedLanguage =
  | "english"
  | "pidgin"
  | "slang"
  | "mixed"
  | "yoruba"
  | "igbo"
  | "hausa"
  | "french"
  | "spanish";

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
 * Nigerian slang and informal greetings. Unlike the Pidgin markers these are
 * not full Pidgin sentences, but they are deliberate casual style, so a message
 * built from them must be answered in an informal Nigerian tone, never with
 * corporate English.
 */
export const SLANG_MARKERS = new Set([
  "wagwan", "wassup", "whassup", "sup", "howfar", "baddest", "boss", "gang",
  "chop", "life", "soft", "sharp", "sweet", "wahala", "gbedu", "gist", "japa",
  "sha", "sef", "no", "omo", "guy", "guys", "bros", "bro", "sis", "abi",
  "gbam", "gbege", "kolo", "sabi", "yen", "azaman", "chill", "vibe", "vibes",
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

/**
 * Strong signals for each additional language we support. A message that
 * contains enough of these markers is classified as that language (checked
 * before the Pidgin/English heuristics, since a greeting like "Bawo ni" looks
 * like English stop words otherwise).
 */
const YORUBA_MARKERS = new Set([
  "bawo", "ni", "se", "o", "n", "wo", "lo", "wa", "ti", "mo", "re", "ki",
  "pe", "sugbon", "kilo", "eleyi", "owo", "e", "ku", "ise", "da", "pele",
]);

const IGBO_MARKERS = new Set([
  "ndeewo", "bia", "daalụ", "ebiela", "nke", "gini", "biko", "chukwu", "nwa",
  "ụwa", "ọrụ", "akwụkwọ", "egwu", "ọgụ", "ịa", "ịhụ", "ịkpọ",
]);

const HAUSA_MARKERS = new Set([
  "sannu", "ina", "kwana", "lafiya", "na", "gaskiya", "yawa", "wannan",
  "tazo", "sabu", "ka", "ku", "shi", "su", "yaki", "aiki", "gida",
]);

const FRENCH_MARKERS = new Set([
  "bonjour", "merci", "oui", "non", "le", "la", "les", "un", "une", "et", "ou",
  "qu'est", "que", "comment", "pourquoi", "prix", "produit",
]);

const SPANISH_MARKERS = new Set([
  "hola", "gracias", "sí", "no", "el", "la", "los", "las", "un", "una", "y",
  "o", "qué", "por", "precio", "producto",
]);

/**
 * Detect whether `text` is in one of the supported non-English languages.
 * Returns null when none of the language-specific markers fire strongly enough.
 */
function detectExtendedLanguage(text: string): DetectedLanguage | null {
  const tokens = tokenize(text);
  if (tokens.length === 0) return null;

  let yoruba = 0;
  let igbo = 0;
  let hausa = 0;
  let french = 0;
  let spanish = 0;

  for (const token of tokens) {
    if (YORUBA_MARKERS.has(token)) yoruba += 1;
    else if (IGBO_MARKERS.has(token)) igbo += 1;
    else if (HAUSA_MARKERS.has(token)) hausa += 1;
    else if (FRENCH_MARKERS.has(token)) french += 1;
    else if (SPANISH_MARKERS.has(token)) spanish += 1;
  }

  const total = tokens.length;
  // Require at least two markers so a single ambiguous word (e.g. "ku", which
  // is Hausa but also appears in Yoruba greetings) cannot misclassify a message.
  const threshold = Math.max(2, Math.ceil(total * 0.25));

  if (yoruba >= threshold) return "yoruba";
  if (igbo >= threshold) return "igbo";
  if (hausa >= threshold) return "hausa";
  if (french >= threshold) return "french";
  if (spanish >= threshold) return "spanish";

  return null;
}

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

  // Non-English languages first: their greetings look like English stop words
  // to the Pidgin/English heuristics, so check them before anything else.
  const extended = detectExtendedLanguage(text);
  if (extended) return extended;

  let pidginTokenCount = 0;
  let slangTokenCount = 0;
  let englishTokenCount = 0;
  const distinctMarkers = new Set<string>();

  for (const token of tokens) {
    if (PIDGIN_MARKERS.has(token)) {
      pidginTokenCount += 1;
      distinctMarkers.add(token);
    } else if (SLANG_MARKERS.has(token)) {
      slangTokenCount += 1;
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

  // Pure slang/informal greeting ("wagwan gang", "wassup boss"): at least one
  // strong slang marker and no real English content words to outweigh it. Such
  // messages must be answered informally, not with corporate English.
  if (slangTokenCount >= 1 && englishTokenCount <= slangTokenCount) {
    return "slang";
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
    case "slang":
      return "The customer is writing in informal Nigerian slang. Reply in a relaxed, casual Nigerian tone that matches their energy. Do not open with corporate phrases like 'Welcome' or 'How may I assist you'. Keep it short and informal.";
    case "mixed":
      return "The customer is mixing English and Nigerian Pidgin. Reply in the same mixed style. Match their tone and vocabulary.";
    case "yoruba":
      return "The customer is writing in Yoruba. Reply in Yoruba, matching their dialect and tone. Do not switch to English unless they do.";
    case "igbo":
      return "The customer is writing in Igbo. Reply in Igbo, matching their dialect and tone. Do not switch to English unless they do.";
    case "hausa":
      return "The customer is writing in Hausa. Reply in Hausa, matching their dialect and tone. Do not switch to English unless they do.";
    case "french":
      return "The customer is writing in French. Reply in French. Do not switch to English unless they do.";
    case "spanish":
      return "The customer is writing in Spanish. Reply in Spanish. Do not switch to English unless they do.";
    case "english":
    default:
      return "The customer is writing in English. Reply in clear English.";
  }
}
