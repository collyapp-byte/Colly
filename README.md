# Colly

Colly is a multi-tenant AI assistant for Nigerian small businesses. It answers customer
messages on the channels a shop actually uses, from that shop's own catalogue and FAQs,
and hands the conversation to a human when it should.

**Live channels:** Telegram (self-serve bot), Discord (self-serve bot) and Web Chat
(embed snippet + printable in-store QR). **WhatsApp** is available through a manual
onboarding waitlist — owners join it from the dashboard and Colly's team switches the
channel on.

## What it does

| Area | Highlights |
| --- | --- |
| AI replies | DeepSeek first, then Groq, then OpenRouter (all OpenAI-compatible); tool-calling forced for every product/price/stock question so answers come from the catalogue, never from memory. Plain-text replies, no stock quantities disclosed, automatic human takeover. |
| Catalogue | Products with price, floor price (negotiation limit), negotiable flag, stock, images and descriptions; CSV upload; semantic search (Jina embeddings) with a `pg_trgm` fallback. |
| Inbox | Conversation list ordered by last activity, message history, AI pause/resume (takeover), manual replies that cost no credits. |
| CRM | Customer records ranked by activity, tags, and a four-stage deal pipeline (inquiry → negotiating → paid → delivered). |
| Billing | Free tier + Green/Blue/Black plans, split wallet (monthly plan credits + permanent top-ups), credit packs, Paystack checkout, cancellation, invoices/sales, usage dashboard. |
| Channels | Telegram bot connect, Discord bot connect, Web Chat widget + QR generator, owner alerts on Telegram, WhatsApp waitlist. |
| Agents | A separate partner surface: four certification courses, quizzes with explanations, badges, a 40-question final exam, PDF/SVG certificates, referral tracking, 15% commission for 12 months and Paystack payouts (min ₦5,000). |
| Ops | Health endpoint, weekly HTML business report, and a secret-protected maintenance cron that sweeps expired plans and refills the Free allowance. |

## Stack

Next.js 16 (App Router, Turbopack, `cacheComponents`) · React 19 · TypeScript ·
Tailwind CSS v4 · Prisma 6 + PostgreSQL (Supabase) · Supabase Auth (`@supabase/ssr`) ·
DeepSeek → Groq → OpenRouter · Paystack · Jina embeddings · Umami + Microsoft Clarity (optional).

## Quick start

```bash
cp .env.example .env   # fill in DATABASE_URL, DIRECT_URL, Supabase, one AI provider key
npm install
npx prisma migrate deploy   # or: npx prisma migrate dev
npm run seed                # demo tenant + academy content (never against production)
npm run dev                 # http://localhost:3000
```

Sign up with `demo@colly.test` to claim the seeded "ABC Electronics" tenant, or create
a fresh account — new accounts start on the permanent Free plan (80 credits / 30 days).

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `npm run start` | Production build and serve |
| `npm run lint` | ESLint (must be clean) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Node test runner via `tsx` (`tests/*.test.ts`) |
| `npm run seed` | Destructive demo reset (business, conversations, products, academy content) |
| `npm run academy:sync` | Upserts `prisma/academy-content.cjs` only — safe for production |

## Architecture

```
app/
  (public)/            marketing, privacy, terms, find-an-agent
  (auth)/              login, signup (business + agent)
  (dashboard)/         inbox, products, customers, sales, invoices, AI, billing, settings
  (agents)/            agent training, quizzes, final exam, certificate, wallet, referrals
  api/                 ~60 route handlers (chat, channels, billing, products, agents, cron)
components/            UI grouped by surface (dashboard, conversations, agents, products, ui)
lib/                   domain logic: chat-engine, ai (DeepSeek→Groq→OpenRouter), plans,
                       credits, tools, logger, negotiation, invoices, badges,
                       certification, agent-auth, pagination
prisma/                schema, migrations, seed.cjs, academy-content.cjs
scripts/               academy sync, embedding backfill
tests/                 node:test suites (plans, academy content, negotiation, pagination,
                       geo/AEO, SEO)
docs/                  content audit register, QA audit snapshot, docs index
```

Route handlers are thin: business logic lives in `lib/`, and `lib/chat-engine.ts` is the
single place a reply is generated, charged and stored.

## Credits and plans

1 credit = ₦1. AI replies cost **5** credits on Telegram/Discord/Web Chat and **80** on
WhatsApp; manual replies are free.

| Plan | Price (monthly) | Credits per month |
| --- | --- | --- |
| Free | ₦0 | 80 (re-granted every 30 days) |
| Green | ₦15,000 | 23,000 |
| Blue | ₦25,000 | 41,000 |
| Black | ₦50,000 | 90,000 |

Plan credits reset each billing month (no rollover); top-up credits never expire and are
spent only after plan credits run out. The Free allowance is re-granted lazily on the
next wallet read (dashboard, usage API, AI page) and by the maintenance cron.
`lib/plans.ts` is the canonical source — every price, grant and reply cost in this README
is derived from it and asserted by `tests/plans.test.ts`.

## Testing and CI

`npm test` runs six suites with the Node test runner (`tsx`, no Jest/Vitest):

- `tests/plans.test.ts` — plan/credit invariants, the wallet spend order and the rule that
  no plan card advertises WhatsApp (waitlist-only) credits.
- `tests/academy-content.test.ts` — course/lesson/quiz/exam integrity, plus a guard that
  fails on retired claims and on drift from `lib/plans.ts`.
- `tests/negotiation.test.ts` — counter-offer ladder and offer parsing.
- `tests/pagination.test.ts` — cursor encode/decode and page-size clamping.
- `tests/geo.test.ts` — city/country/competitor pages, JSON-LD, FAQ copy, `llms.txt`,
  the `public/.well-known/ard.json` manifest and the proxy matcher that must never
  intercept crawler files.
- `tests/seo.test.ts` — sitemap/robots/canonicals and the homepage structured data.

`.github/workflows/ci.yml` runs lint → typecheck → test on every push and pull request.
`npm run build` is not part of CI because it needs real provider credentials; run it
before deploying.

## Operations

- `GET /api/health` — liveness (no auth).
- `GET /api/cron/maintenance` — Bearer `CRON_SECRET`; demotes expired paid plans, refills the Free allowance, and sends the weekly Telegram digest to owners who linked a chat. Scheduled every 6 hours by `.github/workflows/maintenance.yml` (needs `APP_URL` and `CRON_SECRET` repository secrets); `?digest=force|skip` overrides the Monday-only digest.
- Paystack webhook: `POST /api/billing/webhook` (`PAYSTACK_SECRET_KEY`).
- Telegram webhook must point at `NEXT_PUBLIC_APP_URL/api/telegram/webhook`; Discord at
  `/api/discord/webhook`. Telegram connect refuses localhost.
- WhatsApp onboarding is manual: owners join the waitlist, then the team sets
  `Business.channel`/chat id server-side.

## Documentation

- [`AGENTS.md`](./AGENTS.md) — repo contract for humans and AI agents (conventions, gotchas).
- [`docs/README.md`](./docs/README.md) — docs index and the canonical-source table.
- [`docs/CONTENT_AUDIT.md`](./docs/CONTENT_AUDIT.md) — what was stale, wrong or missing.
- [`docs/QA_AUDIT_V2.md`](./docs/QA_AUDIT_V2.md) — engineering QA audit with a live status column.

