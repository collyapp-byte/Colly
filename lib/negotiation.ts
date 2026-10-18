// Deterministic price negotiation engine.
//
// The LLM writes the words, but the numbers come from here. A counter offer
// never falls below the floor and never jumps straight to it: each round gives
// up at most 15% of the remaining gap, so the AI negotiates in small steps.

export type NegotiationState = {
  productName?: string;
  listPrice: number;
  floorPrice: number | null;
  currentOffer: number;
  round: number;
  maxRounds: number; // default 6
  cumulativeConcession?: number;
  startingPrice?: number;
};

/** How many offers the AI will entertain before holding its price. */
export const DEFAULT_MAX_ROUNDS = 6;

// The most we ever give up in a single round, as a fraction of the remaining
// gap between the standing price and the floor.
const MAX_CONCESSION_FRACTION = 0.15;

// Counters are advertised in whole hundreds of Naira; messy amounts read as
// haggling rather than a considered price.
const ROUND_TO = 100;

function roundToNearest(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/**
 * Work out the AI's next counter offer.
 *
 * `currentOffer` is the AI's own standing price (it starts at the list price
 * and steps down each round); it is not the customer's offer. The customer's
 * number only decides *that* we are negotiating, not how far the AI moves.
 */
export function calculateCounterOffer(state: NegotiationState): {
  counter: number;
  isFinal: boolean;
  explanation: string;
} {
  const { currentOffer, floorPrice, round, maxRounds } = state;

  // Out of rounds: hold the standing price.
  if (round >= maxRounds) {
    return {
      counter: currentOffer,
      isFinal: true,
      explanation: "This is my best price.",
    };
  }

  const floor = floorPrice ?? 0;

  // Already at (or below) the floor: pin to the floor and stop.
  if (currentOffer <= floor) {
    return {
      counter: floor,
      isFinal: true,
      explanation: "This is my best price.",
    };
  }

  const gap = currentOffer - floor;
  const concession = gap * MAX_CONCESSION_FRACTION;

  let counter = roundToNearest(currentOffer - concession, ROUND_TO);

  // Never step below the floor, and never quote more than the standing price.
  if (counter < floor) counter = floor;
  if (counter > currentOffer) counter = currentOffer;

  const isFinal = counter === floor || round >= maxRounds - 1;

  let explanation: string;
  if (counter === floor) {
    explanation = "This is my best price.";
  } else if (isFinal) {
    explanation = "This is my best price. I cannot go any lower.";
  } else if (gap <= state.listPrice * 0.1) {
    explanation = "I can drop just a little more.";
  } else {
    explanation = "I can drop a little.";
  }

  return { counter, isFinal, explanation };
}

// ---------------------------------------------------------------------------
// Offer parsing
// ---------------------------------------------------------------------------

// Spelled-out numbers, so "one hundred thousand" is not missed.
const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
  thousand: 1000,
  million: 1000000,
};

type Candidate = { value: number; strong: boolean };

/** Pull every spelled-out number out of a message ("one hundred thousand"). */
function parseWordAmounts(text: string): number[] {
  const amounts: number[] = [];
  const tokens = text.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/);

  let current = 0;
  let total = 0;
  let seen = false;

  const flush = () => {
    if (seen) {
      amounts.push(total + current);
      current = 0;
      total = 0;
      seen = false;
    }
  };

  for (const token of tokens) {
    if (!token) continue;
    if (token === "and") continue;

    const word = NUMBER_WORDS[token];
    if (word === undefined) {
      flush();
      continue;
    }

    seen = true;

    if (word === 100) {
      current = (current || 1) * 100;
    } else if (word >= 1000) {
      total += (current || 1) * word;
      current = 0;
    } else {
      current += word;
    }
  }

  flush();
  return amounts;
}

// Matches "100k", "1.5m", "100,000", "₦100000", "NGN 100,000" and plain
// digits. The optional prefix (₦ / NGN / N) and suffix (k / m / thousand /
// million) are treated as strong signals.
const DIGIT_AMOUNT_RE =
  /(?<![a-z0-9])(₦|ngn|n)?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?\s*(?:(k|m|thousand|million)\b)?/gi;

function parseDigitAmounts(text: string): Candidate[] {
  const candidates: Candidate[] = [];

  for (const match of text.toLowerCase().matchAll(DIGIT_AMOUNT_RE)) {
    const prefix = match[1];
    const whole = match[2];
    const decimals = match[3];
    const suffix = match[4];

    let value = Number(
      whole.replace(/,/g, "") + (decimals ? `.${decimals}` : ""),
    );
    if (!Number.isFinite(value)) continue;

    const s = suffix?.toLowerCase();
    if (s === "k" || s === "thousand") value *= 1000;
    else if (s === "m" || s === "million") value *= 1000000;

    const strong = Boolean(prefix) || Boolean(suffix) || whole.includes(",");
    candidates.push({ value, strong });
  }

  return candidates;
}

/**
 * Extract a Naira amount from a customer message.
 *
 * Understands "100k", "100,000", "₦100000", "NGN 100,000" and "one hundred
 * thousand", and returns a plain integer, or null when there is no amount.
 * Low offers are returned as-is: the state machine, not the parser, enforces
 * the floor.
 */
export function parseOffer(message: string, listPrice: number): number | null {
  if (!message) return null;

  const candidates: Candidate[] = [
    ...parseDigitAmounts(message),
    ...parseWordAmounts(message).map((value): Candidate => ({ value, strong: true })),
  ].filter((c) => Number.isFinite(c.value) && c.value >= 100);

  if (candidates.length === 0) return null;

  // Explicit Naira / spelled-out amounts are the strongest signal. Bare digits
  // are a fallback; anything under ₦100 (a quantity, a day count) is dropped.
  const strong = candidates.filter((c) => c.strong);
  const pool = strong.length > 0 ? strong : candidates;

  // An offer is normally a price below the list. When several amounts appear,
  // take the highest one still under the list; otherwise the smallest.
  const below = pool.filter((c) => c.value < listPrice);
  const chosen =
    below.length > 0
      ? below.reduce((best, c) => (c.value > best.value ? c : best))
      : pool.reduce((best, c) => (c.value < best.value ? c : best));

  return Math.round(chosen.value);
}
