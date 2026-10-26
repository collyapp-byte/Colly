/**
 * Landing-page FAQ copy. Shared by the rendered `<details>` accordion
 * (`components/marketing/faq.tsx`) and the FAQPage JSON-LD in `lib/seo.ts`, so
 * the answers a crawler reads are always the answers a visitor sees.
 *
 * Keep the answers plain text and free of Markdown: they are emitted verbatim
 * into structured data.
 */

export type MarketingFaq = { q: string; a: string };

export const MARKETING_FAQS: readonly MarketingFaq[] = [
  {
    q: "Will it embarrass me by quoting the wrong price?",
    a: "No. Colly is strictly constrained by the floor prices and rules you set. It will never negotiate below your limit. If a customer asks for something complex like a custom waybill, Colly instantly alerts you to take over.",
  },
  {
    q: "Which channels are supported?",
    a: "Colly works across Telegram, Discord, and Web Chat. Your credits are shared globally across all connected channels, and every paid plan includes bonus credits for free WhatsApp messages.",
  },
  {
    q: "₦15,000 is too much.",
    a: "It costs less than a part-time staff, but it works 24/7, doesn't sleep, and never misses a message. One saved sale usually covers the monthly subscription.",
  },
  {
    q: "How fast can I get started?",
    a: "You can connect your Telegram bot or add Web Chat in minutes with no SIM card required. Add Discord just as easily from the dashboard.",
  },
];
