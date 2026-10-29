/**
 * Landing-page FAQ copy — a "stacked Q&A" block (AEO formatting).
 *
 * Every entry is rendered from this one array three ways: as an `<h2>` question
 * with a visible answer, inside the FAQPage JSON-LD that
 * `components/marketing/faq.tsx` emits, and as plain text in the first HTML
 * paint. That is the shape an answer engine / RAG pipeline can actually use: the
 * question phrased the way a person asks it, followed by a self-contained
 * 40–60 word answer it can quote without stitching paragraphs together.
 *
 * Rules:
 * - `q` is an exact user question ending in "?" — never a label like "Pricing".
 * - `a` answers immediately, in 40–60 words, and stands alone with no context
 *   from the surrounding page. No Markdown: it is emitted verbatim into
 *   structured data.
 * - `detail` is optional second-paragraph nuance (caveats, examples).
 * - Prices and credit costs come from `lib/plans.ts`, never typed by hand.
 *
 * `tests/geo.test.ts` enforces the word range and the question mark, so this
 * copy cannot quietly drift back into marketing prose.
 */

import { formatNaira } from "@/lib/format";
import { FREE_PLAN_LIMITS, PLANS, REPLY_CREDIT_COSTS } from "@/lib/plans";

/** The word range a direct answer must hit. Exported so the test and the copy agree. */
export const FAQ_ANSWER_WORDS = { min: 40, max: 60 } as const;

export type MarketingFaq = {
  /** The exact question, used as the on-page `<h2>` and the schema `name`. */
  q: string;
  /** The direct answer: 40–60 words, self-contained, plain text. */
  a: string;
  /** Optional elaboration rendered under the direct answer. */
  detail?: string;
};

export const MARKETING_FAQS: readonly MarketingFaq[] = [
  {
    q: "How much does Colly AI cost?",
    a: `Colly AI is free for ${FREE_PLAN_LIMITS.credits} AI credits every month, and manual replies are always free. Paid plans start at ${formatNaira(
      PLANS.green.monthly,
    )} per month for ${PLANS.green.credits.toLocaleString()} credits, then ${formatNaira(
      PLANS.blue.monthly,
    )} and ${formatNaira(
      PLANS.black.monthly,
    )}. One credit is one Naira, and an AI reply on Telegram, Discord or Web Chat costs ${
      REPLY_CREDIT_COSTS.standard
    } credits.`,
    detail:
      "Plan credits reset every billing month, while top-up credits are sold at face value and never expire.",
  },
  {
    q: "Will Colly AI quote the wrong price or go below my floor?",
    a: "No. Colly answers only from the catalogue you load, so it quotes your real price and stock instead of guessing. It negotiates up to the limit you set and never goes below your floor price, and it hands the chat to you whenever a request needs a human decision.",
    detail:
      "Ask for a custom waybill or a bulk order and the owner gets an alert to take the conversation over.",
  },
  {
    q: "Which channels does Colly AI work on?",
    a: `Colly replies on Telegram, Discord and Web Chat, and all three share one credit balance. Telegram, Discord and Web Chat connect yourself in minutes with no SIM card and no CAC certificate. WhatsApp is onboarded from a manual waitlist because Meta requires business verification, and a WhatsApp reply costs ${REPLY_CREDIT_COSTS.whatsapp} credits.`,
  },
  {
    q: "Do I need a CAC certificate to use Colly AI?",
    a: "No CAC certificate is needed to start. Telegram, Discord and Web Chat run without Meta verification, so a small business can begin replying the same day. WhatsApp is different: Meta requires a CAC certificate and a review, which is why Colly onboards WhatsApp through a manual waitlist instead of self-serve.",
  },
  {
    q: "How fast can I get started with Colly AI?",
    a: "Most businesses are live the same day. Create an account, add your products, then connect a Telegram bot or drop the Web Chat widget on your site — each takes minutes and needs no SIM card. The free tier is active immediately, so you can test real replies before paying.",
  },
];
