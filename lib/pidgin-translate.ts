// Lightweight Nigerian Pidgin → English translation for semantic search.
//
// Jina's embedding model only reliably handles Pidgin when the query contains
// an English anchor word ("abeg how much be that TV" works because of "TV"). A
// phrase like "the big screen wey dey your shop" has no anchor and embeds to
// nothing useful, so we rewrite common Pidgin markers and phrases to plain
// English before embedding.
//
// This is deliberately small and lossy: it is a search aid, not a translator.
// The keyword fallback in lib/tools.ts always uses the ORIGINAL query, so a bad
// translation can never make things worse than not translating at all.

/**
 * Pidgin (and loose descriptive phrase) → English replacements.
 *
 * Order of this literal does not matter: keys are sorted longest-first at
 * module load, so multi-word phrases win over their single-word pieces
 * ("wey dey your shop" before "wey dey" before "wey").
 */
export const PHRASES: Record<string, string> = {
  "wey dey your shop": "in your shop",
  "wey dey": "that is",
  "na how much": "how much is",
  "how much be": "how much is",
  abeg: "please",
  shey: "",
  wetin: "what",
  dey: "is",
  na: "is",
  wey: "that",
  don: "already",
  fit: "can",
  sabi: "know",
  wahala: "problem",
  chop: "eat",
  oya: "okay",
  sef: "even",
  sha: "anyway",
  japa: "leave",
  gbedu: "music",
  "soft life": "comfortable life",
  "big screen": "large television",
  "something for watching": "television for watching",
  "device for charging": "charger for",
  "small small": "a little",
};

/** Keys sorted longest-first so multi-word phrases are replaced before pieces. */
const PHRASES_LONGEST_FIRST = Object.keys(PHRASES).sort(
  (a, b) => b.length - a.length,
);

/** Escape a literal string for safe use inside a RegExp. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Match `phrase` as a whole word / whole phrase (fresh regex, so no lastIndex state). */
function phraseRegex(phrase: string): RegExp {
  return new RegExp(`\\b${escapeRegExp(phrase)}\\b`, "g");
}

/**
 * Translate Nigerian Pidgin markers and phrases in `text` to English.
 *
 * Returns `text` unchanged when it contains none of the known phrases, so plain
 * English queries (and product codes like "samsng a15") are never mangled.
 * Matching is case-insensitive; the translated result is lower-cased.
 */
export function translatePidgin(text: string): string {
  const lower = text.toLowerCase();

  const hasMarker = PHRASES_LONGEST_FIRST.some((phrase) =>
    phraseRegex(phrase).test(lower),
  );

  if (!hasMarker) {
    return text;
  }

  let result = lower;

  for (const phrase of PHRASES_LONGEST_FIRST) {
    result = result.replace(phraseRegex(phrase), PHRASES[phrase]);
  }

  return result.replace(/\s+/g, " ").trim();
}
