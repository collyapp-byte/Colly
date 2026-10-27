<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Colly - AI agent instructions

This is a multi-tenant small business assistant (Next.js 16 App Router + Prisma + Supabase + DeepSeek). The most important repo-specific details follow.

## Commands

- `npm run dev` - start dev server (Next.js 16)
- `npm run build` - production build
- `npm run start` - run built app
- `npm run lint` - lint (eslint)
- `npm run typecheck` - `tsc --noEmit`
- `npm test` - unit tests (`tsx --test tests/*.test.ts`)
- `npm run seed` - full demo reset (`node prisma/seed.cjs`) — never against production
- `npm run academy:sync` - push `prisma/academy-content.cjs` to the DB without wiping tenants

Required before submitting changes: `npm run lint`, `npm run typecheck` and `npm test`
(CI runs exactly these three). Add a test when you change a pure helper in `lib/`, the
academy content, or a pricing/credit rule.

## Database & Prisma

- Schema: `prisma/schema.prisma` (Postgres). Every non-Business model is scoped by `businessId` with cascade from Business.
- Client singleton: `lib/prisma.ts` (global cached in dev to avoid connection pool exhaustion).
- Seed: `prisma/seed.cjs` (dotenv-loaded). Wipes all data (cascade-safe order). Creates business `test-biz-1` ("ABC Electronics"), demo owner `demo@colly.test` (password empty, `supabaseUserId` null), products, 3 conversations with messages (including one agent-sent message). Re-running is safe. Note: seed cannot create Supabase Auth user; signup with demo email links the unclaimed User row to auth. Academy content is read from `prisma/academy-content.cjs`: lessons are upserted by slug (agent progress survives), quiz questions and the final exam are replaced on each run.
- Use Prisma Accelerate mentioned in schema only if needed; not required locally.
- `Conversation.lastMessageAt` (newest message stamp) is denormalised and maintained by the `message_touch_conversation_activity` trigger from `prisma/migrations/20261026000000_qa_indexes`; app code never writes it, and the trigger leaves `updatedAt` alone (the Telegram takeover clock reads it). That migration also creates `pg_trgm` + `product_name_trgm_idx` (lib/tools.ts fuzzy search) and the composite Message/Conversation indexes the inbox, history and usage queries need.

## Auth (Supabase)

- Server client: `lib/supabase/server.ts` uses `@supabase/ssr` with async `cookies()`; setAll swallows errors in Server Components (proxy refreshes session). Always create per request.
- Browser client: `lib/supabase/client.ts` uses `@supabase/ssr` createBrowserClient.
- Env: `lib/supabase/env.ts` reads `NEXT_PUBLIC_SUPABASE_URL` and either `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (accepts both). Missing config throws explicit error.
- Auth helpers: `lib/auth.ts` - `getCurrentUser()` validates token via `supabase.auth.getUser()` and maps to DB User+Business (prefers `supabaseUserId`, falls back to email on unclaimed rows, links on first match). `getCurrentBusinessId()` returns tenant id or null. `requireAuth()` redirects to `/login` if no session; throws if session exists but no tenant linked (prevents redirect loop). `AuthUser` includes business fields.

## Chat / AI (DeepSeek)

- DeepSeek via OpenAI-compatible SDK: `lib/deepseek.ts`. Model `deepseek-chat`, default base URL `https://api.deepseek.com`, lazy client reads `DEEPSEEK_API_KEY` and optional `DEEPSEEK_BASE_URL`. Overloads: no tools returns `string`, with tools returns full `ChatCompletion`. Throws if empty reply.
- Chat engine: `lib/chat-engine.ts` - `handleIncomingMessage({ businessId, customerPhone, message, skipCustomerMessage? })` returns an `EngineResult`. This is where all reply generation lives: resolves/creates the customer by phone, reuses latest conversation or creates new (status OPEN), saves the customer message (unless `skipCustomerMessage`), respects `conversation.pausedUntil` (human takeover), loads last HISTORY_LIMIT=20 messages (desc->reverse), builds the system prompt via `buildSystemPrompt()` (identity, optional business.description/hours, SYSTEM_PROMPT_RULES, tone last), loops tool calls up to MAX_TOOL_ROUNDS=2, computes AI usage, and saves the AI reply as sender "ai". Tool: `search_products` (defined in TOOLS) - returns up to 5 matches (name, price in Naira, stock, description); `runToolCall()` calls `searchProducts(businessId, query)` from `lib/tools.ts`; `readQuery()` defensively parses JSON args. Sender values stored: "customer", "ai", "agent".
- Chat route: `app/api/chat/route.ts` - now a thin adapter over `lib/chat-engine.ts`. Accepts `{ businessId?, customerId, message }`; authorizes via session or `X-Colly-Internal-Secret`, validates the customer belongs to the business, converts voice/image to text, then delegates to the engine. `audioUrl`/`imageUrl` are fetched server-side by the pipelines, so they are SSRF-checked first by `isTrustedStorageUrl()`: https only, no credentials/odd port, host must equal `NEXT_PUBLIC_SUPABASE_URL`'s host and the path must start `/storage/v1/object/public/` — anything else is a 400. Maps engine `blocked` -> `{ reply: null, paused: true }` and `no_message` -> 400.
- Dashboard assistant: `isDashboardAssistant: true` on `POST /api/chat` is an owner-only path (no customer, no conversation) and is metered like any other AI reply — `chargeAiReply(user.businessId, business.channel)` reserves credits before `askAI()`, the route returns 402 with `LOW_CREDIT_MESSAGE` (`{ blocked: true, reason: "no_credits" }`) when the wallet cannot cover it, and refunds through `refundAiReply()` on a thrown error or `provider === "fallback"` (503, reason `ai_unavailable`).
- Telegram channel: `app/api/telegram/webhook/route.ts` - parses a Telegram update, ignores non-text/unknown chats (always 200), finds the `Business` by `telegramChatId` + `channel: "TELEGRAM"`, upserts a `Customer` via the `businessId_phone` unique (phone=`chat.id`, name=`first_name`), calls the engine, and POSTs the reply to the Telegram Bot API. Silent on cap_hit/paused/failure.
- System prompt constraints (critical): must call search_products for any product/price/stock/availability/spec question (including follow-ups; memory not catalogue). Answer only from tool results; only say "no product" if count==0; only say out of stock if tool shows stock==0. Plain text only (no Markdown/formatting symbols). Never reveal exact stock quantities - only state available/in stock or out of stock/sold out. For multiple products, each on its own line as `Name Price` (no dash/colon/bullet), total on separate line.
- Tone: from Business.tone (validated by `isTone()` from `lib/business.ts`, fallback "friendly"). TONE_INSTRUCTIONS: formal, friendly (light emoji allowed in friendly tone instruction text, but reply must follow plain text rule), pidgin_friendly (Nigerian Pidgin). Tone appended last to bias model.

## Other API routes (high-level)

- `app/api/business/route.ts`: GET returns `{ business, ownerEmail }` for signed-in owner. PATCH updates subset (name/phone/whatsappNumber required if present, tone validated, optional free-text fields stored as null when empty). Scoped to caller's businessId.
- Conversations: `app/api/conversations/route.ts` (list), `[id]/route.ts` (get/update), `[id]/messages/route.ts` (list/add), `[id]/takeover/route.ts` (takeover control).
- List endpoints return one page (`LIST_PAGE_SIZE = 50`): conversations (`ORDER BY lastMessageAt DESC` in SQL — the in-memory sort is gone), products (newest first), invoices (newest first) and customers (newest 50, then ranked by activity in memory). They accept an optional `?cursor=` (see `lib/pagination.ts`) and return `nextCursor`; without a cursor the first page is unchanged. A new list endpoint must add `take` and reuse the helper.
- Customers: `app/api/customers/route.ts`, `[id]/route.ts`, `status/route.ts` (CRM Kanban: `INQUIRY | NEGOTIATING | PAID | DELIVERED`).
- Products: `app/api/products/route.ts`, `[id]/route.ts`, `import/route.ts` (multipart CSV upload), `import-jiji/route.ts` (seller URL/username → catalogue), `sync-jiji/route.ts` (GET status card / POST re-sync prices and stock).
- Telegram: `app/api/telegram/webhook/route.ts` (see Chat/AI above) and `connect/route.ts` (BotFather token → verified bot).
- Discord: `app/api/discord/webhook/route.ts` + the `saveDiscordBotToken` server action.
- Web Chat: `app/api/chat/web/route.ts` (public widget endpoint) and `app/(dashboard)/settings/web-chat|qr-code`.
- Billing: `app/api/billing/checkout/route.ts` (accepts `{ tier, interval, channel? }`; channel defaults to `business.channel`, validated with `isChannel`, and drives tier validation/price/plan code), `verify/route.ts` (on subscription activation sets `business.plan`, `planStatus`, and `channel`), `usage/route.ts` (returns AI + manual usage, the split wallet as `planCredits` + `topUpCredits` with their total `creditBalance`, plus `planMonthlyCredits` and `aiCreditCost`), `credits/checkout/route.ts` (top-ups), `cancel/route.ts`, `transactions/route.ts`, `webhook/route.ts` (Paystack).
- Agents (academy/partner surface): `app/api/agents/*` — `signup`, `me`, `training`, `training/[courseSlug]`, `training/[courseSlug]/[lessonSlug]`, `lessons/[lessonId]/complete`, `quiz/submit`, `final-exam`, `certificate` (+ `pdf`, `badge`), `badges` (+ `[courseSlug]/svg|png`), `leaderboard`, `referrals`, `bank-details`, `payouts/request`.
- Reports & alerts: `app/api/reports/weekly/route.ts` (HTML report: AI replies, manual replies, escalations, sales), owner notifications via Telegram.
- Housekeeping: `app/api/health/route.ts` (liveness, no auth), `app/api/waitlist/route.ts` (WhatsApp waitlist: GET status for the signed-in business, POST with number normalisation + dedupe + in-process throttle), `app/api/business/nrs/route.ts` (NRS e-invoicing compliance fields on the business), `app/api/voice/transcribe-description/route.ts` (voice/image → product description).
- Maintenance cron: `app/api/cron/maintenance/route.ts` (Bearer `CRON_SECRET`) — runs `downgradeExpiredPlan` + `ensureFreeGrant` for every business (batched, default 500) and, on Mondays or `?digest=force`, sends each owner a 7-day Telegram digest through `sendOwnerAlert`; triggered by `.github/workflows/maintenance.yml` every 6 hours.

## Agent academy & partner domain

- Content lives in `prisma/academy-content.cjs` (4 courses, lessons, quiz sets, 40-question final exam). It is the single source of truth for what agents are taught. `prisma/seed.cjs` seeds it (full reset) and `npm run academy:sync` (`scripts/sync-academy-content.cjs`) upserts content only — no business/customer/agent data is touched.
- Certificates come from the **final exam** (`lib/certification.ts`), not from course quizzes. Quizzes award badges (`lib/badges.ts`, gated on all lessons complete + an 80% pass), and all four badges unlock the exam (`app/api/agents/final-exam/route.ts`). Lesson progress is keyed by `(courseId, slug)`, so never rename a lesson slug unless you accept resetting that lesson's ticks.
- `AgentQuizQuestion.explanation` is rendered by the quiz page after a wrong answer; the seed writes it from the content module. Every question must have one (`tests/academy-content.test.ts` enforces it).
- Agent auth is separate from owner auth: `lib/agent-auth.ts#getCurrentAgent()` reads the Supabase session and maps it to an `Agent` row. Agents sign up through `POST /api/agents/signup`; owners never see `/agents`.
- Referrals: a business records `referredByAgentId` + `commissionEndsAt` (12 months) at signup. The agent earns 15% of each subscription charge; `commissionBalanceNaira` is credited by the billing webhook and paid out via Paystack (`/api/agents/payouts/request`, minimum ₦5,000, bank details required).
- Certificates render as PDF/SVG under `app/api/agents/certificate/*` and `badges/[courseSlug]/{svg,png}`.


- Next.js 16 App Router. Routes under `app/` with route groups `(auth)`, `(dashboard)`, `(agents)`, `(public)` and dynamic segments `[id]`/`[courseSlug]`.
- API routes use route.ts (no Edge runtime specified). Server Components default.
- UI components: `components/` organized (auth, conversations, dashboard, products, agents, ui). Styling via Tailwind v4 (`globals.css`, `@tailwindcss/turbopack` configured).
- Lib: `lib/` has domain/auth/ai/supabase utilities. Path alias `@/*` -> `./*`.
- Types/validation helpers in `lib/business.ts`, `lib/format.ts`, `lib/products.ts`, `lib/tools.ts`, `lib/agents-types.ts`.
- Non-app code: `prisma/` (schema, migrations, seed, academy content), `scripts/` (`sync-academy-content.cjs`, `backfill-embeddings.cjs`), `tests/` (node:test suite), `docs/` (content audit + docs index).
- Generated files under `.next/` (build/dev). Do not edit `.next/`.

## Environment & setup

- No `.env.example` present. Required env vars: `DATABASE_URL`, `DIRECT_URL` (Prisma Postgres), `DEEPSEEK_API_KEY` (required for chat), optional `DEEPSEEK_BASE_URL`, and Supabase `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or PUBLISHABLE). Seed uses dotenv (`prisma/seed.cjs`).
- `.env.example` **is** committed and is the reference list: `DATABASE_URL`, `DIRECT_URL`, `DEEPSEEK_API_KEY` (+ optional `DEEPSEEK_BASE_URL`), Supabase URL + anon/publishable key, `NEXT_PUBLIC_APP_URL`, `COLLY_TELEGRAM_BOT_TOKEN` (owner alerts), Paystack secret and plan codes, `CHAT_INTERNAL_SECRET`, `REEF_API_KEY` (Jiji; blank = mock import), `JINA_API_KEY` (embeddings), `CRON_SECRET` (maintenance route), `NEXT_PUBLIC_UMAMI_WEBSITE_ID` (page analytics) and `NEXT_PUBLIC_CLARITY_ID` (session recordings). Copy it to `.env`, then `npm run seed` for demo data and `npm run dev`.
- Analytics (all optional): set `NEXT_PUBLIC_UMAMI_WEBSITE_ID` to switch Umami on — the script and `<UmamiTracker />` are only rendered when it is set, and every `trackEvent()` call is a no-op without it. Set `NEXT_PUBLIC_CLARITY_ID` to switch Clarity on. With neither set, local clones and previews stay silent.

## Conventions / gotchas

- Keep chat replies plain text only (see SYSTEM_PROMPT_RULES line with extensive formatting ban). Never add Markdown.
- Never reveal exact stock quantities in responses - only availability states.
- Tool calling is mandatory for product questions; chat enforces with explicit rules and follow-up note.
- Human takeover: `conversation.pausedUntil` gates AI replies (returns paused true if active). Agent messages use sender "agent".
- Channels: `Business.channel` is one of `TELEGRAM`, `DISCORD`, `WEB_CHAT`, `WHATSAPP` (`lib/business.ts#isChannel`, schema enum `Channel`). Telegram, Discord and Web Chat are live and self-serve; WhatsApp is a **manual onboarding waitlist** (`WhatsAppWaitlist` model + `/api/waitlist` + the form on `/settings/ai-line`), so never promise a self-serve WhatsApp connection. Plans are one unified tier set for every channel — `green` (₦15,000 → 23,000 credits), `blue` (₦25,000 → 41,000), `black` (₦50,000 → 90,000), plus the permanent `free` tier (80 credits / 30 days). `lib/plans.ts` is the only source of prices, grants, reply costs and reset wording (`getPlanLimits`, `getPlanPrice`, `getMonthlyCredits`, `getPaystackPlanCode`); there is no per-channel tier split and no `channelForTier`/`plansFor` helper any more.
- Credits (split wallet, 1 credit = ₦1): `Business.planCredits` is the plan's monthly allowance — a successful plan charge OVERWRITES it with the tier's grant (`getMonthlyCredits`) in `app/api/billing/verify/route.ts` and both `charge.success` / `invoice.payment_success` in `app/api/billing/webhook/route.ts`, so unused allowance never rolls over. `Business.topUpCredits` is what the business paid for: top-up purchases INCREMENT it and nothing ever resets it. Replies cost 5 credits on Telegram/Discord/Web Chat and 80 on WhatsApp (`getAiReplyCreditCost`); `chargeAiReply` in `lib/chat-engine.ts` spends `planCredits` first then `topUpCredits` inside a `prisma.$transaction` compare-and-swap (retried up to 3 times), and every gate (`auth-guards`, chat engine, conversations API, UI) sums them with `totalAvailableCredits()`. Manual replies are free. `CREDITS_RESET_DISCLAIMER` (lib/plans.ts) is the exact customer-facing wording. Dashboard header shows plan + credit pills (`components/dashboard/plan-chip.tsx`, total with a plan/top-up tooltip); Plans page is Telegram-first. New signups land on the permanent Free plan (`plan: "free"`, `planStatus: "inactive"`, `planCredits: FREE_PLAN_LIMITS.credits` = 80, `topUpCredits: 0`); the 7-day trial is retired, so legacy rows stored as `trial` / `trialing` are read as Free everywhere. The Free 80 is re-granted lazily by `ensureFreeGrant()` in `lib/credits.ts`: once `Business.lastFreeGrantAt` is more than 30 days old it resets `planCredits` to `FREE_PLAN_LIMITS.credits` and stamps the field, using a compare-and-swap `updateMany` on `plan` + the stale stamp so a concurrent paid upgrade (or a parallel request) is never clobbered, and `topUpCredits` is never touched; it returns the same row with the fresh balance. Callers are `requireAiEnabled()` (lib/auth-guards.ts, before any gate so paused-AI accounts still refresh), `GET /api/billing/usage` (dashboard header pills + billing/credits pages) and the AI dashboard page (`app/(dashboard)/ai/page.tsx`), so the balance refreshes without waiting for an AI reply. There is also a scheduler: `/api/cron/maintenance` (Bearer `CRON_SECRET`) sweeps every business through `downgradeExpiredPlan` + `ensureFreeGrant`, so a dormant tenant still refreshes.
- Plan expiry: `downgradeExpiredPlan()` (lib/credits.ts) runs first inside `requireAiEnabled()`, before `ensureFreeGrant` and every gate. It demotes a paid row to Free — `plan: "free"`, `planStatus: "inactive"`, `planCredits: 80`, `lastFreeGrantAt: now`, `subscriptionStatus: "inactive"`, dunning fields cleared — when `planExpiresAt` is past AND `planStatus !== "active"` AND any dunning grace has lapsed; `active` rows are never touched (a late renewal webhook must not cut off a paying customer) and the write is a compare-and-swap on `plan` + `planStatus`, so a concurrent renewal wins. It runs first in `requireAiEnabled()` AND at the top of `GET /api/billing/usage`, so the dashboard plan chip and billing pages drop to Free on the next load instead of waiting for an AI reply.
- Auth linking: seeded/demo users have `supabaseUserId` null; signing up with matching email adopts the row. A signed-in session with no tenant throws (not redirect) to avoid login loop.
- Supabase server client cookie writes ignored in Server Components - by design, proxy handles rotation.
- Prisma logs: errors/warns in dev, errors only in prod.
- Business tone defaults/fallbacks: unknown stored tone falls back to "friendly" in prompt building.
- SearchProducts returns max 5 matches; chat returns count/products to model.
- Analytics: the Umami `<Script>` is rendered exactly once, in the root `app/layout.tsx`, so marketing, auth and dashboard routes all report pageviews. Never add another copy in a nested layout/page (the marketing layout used to have one) — pageviews would be counted twice. Pageviews for App Router (client-side) navigation are sent by `components/analytics/umami-tracker.tsx`, which the layout mounts (inside a `Suspense` boundary, because it uses `useSearchParams`) only when `NEXT_PUBLIC_UMAMI_WEBSITE_ID` is set; the script therefore carries `data-auto-pageview="false"` — the script's own `history.pushState` hook plus the tracker would report every route twice, so the tracker must stay the only sender. Custom events go through `trackEvent(name, data)` in `lib/analytics.ts`, which is a safe no-op during SSR or when the script is missing. The `signup` event (`{ role: "business" | "agent" }`) is fired by `components/auth/business-signup-form.tsx` when `signup()` returns the email-verification state, and by the agent form in `app/(auth)/signup/signup-content.tsx`. A business signup that the server action redirects straight to `/dashboard` (email confirmation off) has no client-side success state, so it is pageview-only; covering it needs a marker (cookie or `?welcome=1`) read on the dashboard.
- Microsoft Clarity (optional session recordings) is the inline snippet in the root layout's `<head>`, rendered with `next/script` `strategy="beforeInteractive"` (`id="microsoft-clarity"`) only when `NEXT_PUBLIC_CLARITY_ID` is set. In the App Router that strategy queues the snippet in the server HTML as a `self.__next_s` entry and the app bootstrap runs it from `document.head` before hydration — `afterInteractive` would defer it to a client effect. It is listed as a processor in `app/(public)/privacy/page.tsx` — keep that list in step with `app/layout.tsx`.
- Next.js 16 experimental flags enabled: `agentFeedback: true`, `cacheComponents: true`, `partialPrefetching: true`. Turbopack configured for CSS. Do not remove the auto-generated Next.js agent rules block.

## Testing / verification

- `npm test` runs `tests/*.test.ts` with the Node test runner through `tsx` (no Jest/Vitest, no new dependency). `npm run typecheck` is `tsc --noEmit`; `npm run lint` must also be clean. CI (`.github/workflows/ci.yml`) runs lint → typecheck → test on every push and PR.
- `tests/plans.test.ts` locks the credit economy: tier totals equal base + bonus (Green 23,000 / Blue 41,000 / Black 90,000), prices (₦15k/₦25k/₦50k), Free's 80, reply costs (5 / 80 / 0) and the plan-before-top-up spend order.
- `tests/academy-content.test.ts` validates `prisma/academy-content.cjs`: badge slugs match `lib/course-badge-meta.ts`, every lesson works, every quiz question has an explanation, the exam is 40 questions (10 per section), and the pricing lesson quotes `lib/plans.ts` exactly. It also fails on retired claims ("WhatsApp Business API", "44,000 credits", "50 credits every month", …) so the content cannot silently drift again.
- `tests/negotiation.test.ts` covers the deterministic counter-offer ladder and offer parsing (`100k`, `₦100,000`, "one hundred thousand").
- `tests/pagination.test.ts` covers the keyset cursor helpers (`lib/pagination.ts`): round-trip, garbage rejection and page-size clamping.
- No integration/e2e tests and no DB in CI: anything touching Prisma (chat engine, billing, cron) is verified manually against the seeded demo tenant. Do not point tests at `DATABASE_URL`.
