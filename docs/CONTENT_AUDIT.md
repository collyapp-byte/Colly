# Content audit — Colly docs, legal copy and agent academy

Status: **closed** (all items below were fixed in the phases listed in
`docs/README.md`). Kept as a register so the same drift can be recognised next time.
Audit basis: repository state at `6675e8e` (post "in-store QR code generator").

The rule for every row: **the canonical source wins**. If a doc, lesson or marketing
string disagrees with `lib/plans.ts`, `prisma/schema.prisma` or the shipped route tree,
the doc is wrong.

## 1. Documentation

| # | Location | Problem | Canonical truth | Fix |
|---|---|---|---|---|
| D1 | `README.md` | Untouched `create-next-app` boilerplate: no product description, no env, no architecture, no test/credit docs. | The codebase. | Rewritten (phase ⑤). |
| D2 | `AGENTS.md` (§Auth/Channels) | "`Business.channel` is `"WHATSAPP"` or `"TELEGRAM"`", and "plan tiers are disjoint per channel (WhatsApp starter/business/pro, Telegram green/blue/black)". | `Channel = TELEGRAM \| DISCORD \| WEB_CHAT \| WHATSAPP` (WhatsApp = waitlist); one unified tier set green/blue/black. | Corrected. |
| D3 | `AGENTS.md` (§Environment) | "No `.env.example` present". | `.env.example` exists and lists every variable, including `PAYSTACK_PLAN_TG_*`, `REEF_API_KEY`, `CHAT_INTERNAL_SECRET`, `NEXT_PUBLIC_APP_URL`. | Corrected. |
| D4 | `AGENTS.md` (§Other API routes) | Lists `app/api/test-db/route.ts` as a live route. | Route does not exist. | Removed. |
| D5 | `AGENTS.md` (route inventory) | Missing ~30 shipped routes: the whole `api/agents/*` surface, `api/discord/webhook`, `api/waitlist`, `api/reports/weekly`, `api/billing/{credits,cancel,transactions}`, `api/health`, `api/products/import`, `api/telegram/connect`, `api/chat/web`, `api/customers/status`, `api/business/nrs`, `api/voice/transcribe-description`. | Route tree under `app/api/`. | Inventory rebuilt. |
| D6 | `AGENTS.md` (architecture) | No mention of the agent (academy/partner) domain: 12 Prisma models, `lib/agent-auth.ts`, `lib/certification.ts`, `lib/badges.ts`, certificate PDF/SVG generation, leaderboard, payouts. | `prisma/schema.prisma` + `app/(agents)`. | Added. |
| D7 | `AGENTS.md` (features) | Does not mention the web-chat widget, QR generator, CRM deal status, weekly report, owner notifications or Discord. | Shipped routes/pages. | Added. |
| D8 | `AGENTS.md` (testing) | Says no test scripts exist and not to add scripts. | `tests/` + `npm test`/`npm run typecheck` now exist. | Corrected. |
| D9 | `QA_AUDIT_V2.md` | 188-line audit pinned to `82b4fa9` with no status column; many items are now fixed (credit reservation, `/test` routes, trigram indexes, AGENTS rewrite, one-page lists). | Current code. | Status table added, superseded items marked. |
| D10 | repo root | `final-exam-questions.txt` was deleted while `prisma/seed.cjs` still read it, so `npm run seed` threw `ENOENT` at the academy step. | Exam content now lives in `prisma/academy-content.cjs`. | Seed no longer reads files. |

## 2. Legal / customer-facing copy

| # | Location | Problem | Canonical truth | Fix |
|---|---|---|---|---|
| L1 | `app/(public)/privacy/page.tsx` | Calls Colly "an AI-powered WhatsApp assistant" and describes data flow as WhatsApp-only. | Multi-channel: Telegram, Discord, Web Chat, WhatsApp (waitlist). | Rewritten. |
| L2 | `app/(public)/privacy/page.tsx` | Names only Meta/WhatsApp as a third-party processor. | Telegram Bot API, Discord API, DeepSeek, Jina (embeddings), Paystack, Supabase, Umami. | Rewritten with a processor list. |
| L3 | `app/(public)/terms/page.tsx` | "Violate Meta's WhatsApp Commerce Policy" as the only channel rule. | Channel-agnostic acceptable-use rule + WhatsApp waitlist clause. | Rewritten. |
| L4 | `app/(dashboard)/settings/ai-line/page.tsx` (`HOW_IT_WORKS`) | "WhatsApp: Connect via Meta (Requires a CAC certificate)" — implies self-serve WhatsApp is live. | WhatsApp is a waitlist; the page now offers "Join the WhatsApp waitlist". | Rewritten + waitlist form (phase ⑦). |

## 3. Agent academy content (`prisma/academy-content.cjs`)

The content used to live inline in `prisma/seed.cjs` (2,476 lines). It is now a
separate module, seeded by `prisma/seed.cjs` and by `npm run academy:sync`.

| # | Location | Problem | Canonical truth | Fix |
|---|---|---|---|---|
| A1 | Lesson `what-whatsapp-business-api-is` | "…we will switch on WhatsApp for them" when a CAC certificate arrives. | WhatsApp is a manual onboarding waitlist; no CAC gate is promised. | Rewritten. |
| A2 | Lesson `what-colly-does` | "Colly is the AI that runs on the WhatsApp Business API". | Colly is channel-agnostic (`lib/chat-engine.ts`). | Rewritten. |
| A3 | Pricing lesson | Blue = 28,000 + 16,000 = 44,000; Black = 60,000 + 40,000 = 100,000. | `lib/plans.ts`: Blue 25,000 + 16,000 = 41,000; Black 50,000 + 40,000 = 90,000. | Corrected. |
| A4 | Pricing lesson, handoff lesson, agent-playbook lessons, demo-business copy | Free plan = 50 credits. | `FREE_PLAN_LIMITS.credits` = 80. | Corrected (five places). |
| A5 | Quiz "Who connects the WhatsApp Business API?" / "Colly will connect your WhatsApp within 24 hours" | Outright false, and tests a deprecated flow. | Multi-channel onboarding. | Replaced. |
| A6 | Whole curriculum | No lesson on the web chat widget, in-store QR, credits/top-ups, CRM deal pipeline, weekly report, owner notifications, Discord, agent payouts, WhatsApp waitlist. | Shipped features. | Lessons added per course. |
| A7 | Every quiz question | `AgentQuizQuestion.explanation` (rendered by the quiz page after a wrong answer) was never populated, so every wrong answer showed the generic fallback. | Explanations authored in content and written by the seed; the final exam now returns a per-question `review` so missed exam questions show their explanation too. | Added to all questions. |
| A8 | Final exam | Source file missing (D10) → no exam rows. | 40 questions, 10 per section, inline and validated by tests. | Authored. |
| A9 | `seed.cjs` ("Personal" business) | New accounts seeded with `planCredits: 50` and a "50 credits" comment. | 80 credits, 30-day lazy re-grant. | Corrected. |

## 4. Dead / unfinished code found during the audit

| # | Location | Problem | Resolution |
|---|---|---|---|
| C1 | `app/api/waitlist/route.ts` | No caller: nothing in the UI let a business join the WhatsApp waitlist. | Waitlist form added to `/settings/ai-line`. |
| C2 | `AgentQuizQuestion.explanation` | Column, type and UI existed; seed never wrote it. | Populated by content, written by seed. |
| C3 | `lib/credits.ts` | `ensureFreeGrant()` / `downgradeExpiredPlan()` only run on a page/API read; no scheduler. | `/api/cron/maintenance` + scheduled workflow. |
| C4 | `components/dashboard/dashboard-shell.tsx` | Carries a `whatsappConnected` prop that no route sets. | Left in place; documented in `AGENTS.md`. |
| C5 | List endpoints | `LIST_PAGE_SIZE = 50` with no cursor, so catalogues above 50 rows are silently truncated. | Shared `lib/pagination.ts` cursor support. |
