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
- `npm run seed` - run Prisma seed (`node prisma/seed.cjs`)

Required before submitting changes: run `npm run lint`. Typecheck is via TypeScript (`tsconfig.json`); there is no separate `typecheck` script. Do not add new scripts unless the task explicitly requires it.

## Database & Prisma

- Schema: `prisma/schema.prisma` (Postgres). Every non-Business model is scoped by `businessId` with cascade from Business.
- Client singleton: `lib/prisma.ts` (global cached in dev to avoid connection pool exhaustion).
- Seed: `prisma/seed.cjs` (dotenv-loaded). Wipes all data (cascade-safe order). Creates business `test-biz-1` ("ABC Electronics"), demo owner `demo@colly.test` (password empty, `supabaseUserId` null), products, 3 conversations with messages (including one agent-sent message). Re-running is safe. Note: seed cannot create Supabase Auth user; signup with demo email links the unclaimed User row to auth.
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
- List endpoints return one page (`LIST_PAGE_SIZE = 50`): conversations (`ORDER BY lastMessageAt DESC` in SQL — the in-memory sort is gone), products (newest first), invoices (newest first) and customers (newest 50, then ranked by activity in memory). Keyset `cursor` pagination is the open follow-up; a new list endpoint must add `take`.
- Customers: `app/api/customers/route.ts`, `[id]/route.ts`
- Products: `app/api/products/route.ts`, `[id]/route.ts`
- Telegram: `app/api/telegram/webhook/route.ts` (see Chat/AI above).
- Billing: `app/api/billing/checkout/route.ts` (accepts `{ tier, interval, channel? }`; channel defaults to `business.channel`, validated with `isChannel`, and drives tier validation/price/plan code), `verify/route.ts` (on subscription activation sets `business.plan`, `planStatus`, and `channel` via `channelForTier(transaction.plan)`), `usage/route.ts` (returns AI + manual usage, the split wallet as `planCredits` + `topUpCredits` with their total `creditBalance`, plus `planMonthlyCredits` and `aiCreditCost`).
- Test DB: `app/api/test-db/route.ts`

## Architecture & layout

- Next.js 16 App Router. Routes under `app/` with route groups `(auth)`, `(dashboard)`, and dynamic segments `[id]`.
- API routes use route.ts (no Edge runtime specified). Server Components default.
- UI components: `components/` organized (auth, conversations, dashboard, products, ui). Styling via Tailwind v4 (`globals.css`, `@tailwindcss/turbopack` configured).
- Lib: `lib/` has domain/auth/ai/supabase utilities. Path alias `@/*` -> `./*`.
- Types/validation helpers in `lib/business.ts`, `lib/format.ts`, `lib/products.ts`, `lib/tools.ts`.
- Generated files under `.next/` (build/dev). Do not edit `.next/`.

## Environment & setup

- No `.env.example` present. Required env vars: `DATABASE_URL`, `DIRECT_URL` (Prisma Postgres), `DEEPSEEK_API_KEY` (required for chat), optional `DEEPSEEK_BASE_URL`, and Supabase `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or PUBLISHABLE). Seed uses dotenv (`prisma/seed.cjs`).
- After setting env, run `npm run seed` to populate demo data (optional but useful). Start with `npm run dev`.
- Analytics (Umami, optional): set `NEXT_PUBLIC_UMAMI_WEBSITE_ID` to switch tracking on. Without it the tracker is never rendered and every `trackEvent()` call is a no-op, so local clones and previews stay silent.

## Conventions / gotchas

- Keep chat replies plain text only (see SYSTEM_PROMPT_RULES line with extensive formatting ban). Never add Markdown.
- Never reveal exact stock quantities in responses - only availability states.
- Tool calling is mandatory for product questions; chat enforces with explicit rules and follow-up note.
- Human takeover: `conversation.pausedUntil` gates AI replies (returns paused true if active). Agent messages use sender "agent".
- Channels: `Business.channel` is `"WHATSAPP"` or `"TELEGRAM"`. Plan tiers are disjoint per channel (WhatsApp starter/business/pro; Telegram green/blue/black), so `channelForTier(tier)` in `lib/plans.ts` infers the channel from an activated plan. Plan tables/limits live in `lib/plans.ts` (`getPlanLimits`, `getPlanPrice`, `getPaystackPlanCode`, `plansFor`, `isTelegramChannel`).
- Credits (split wallet, 1 credit = ₦1): `Business.planCredits` is the plan's monthly allowance — a successful plan charge OVERWRITES it with the tier's grant (`getMonthlyCredits`) in `app/api/billing/verify/route.ts` and both `charge.success` / `invoice.payment_success` in `app/api/billing/webhook/route.ts`, so unused allowance never rolls over. `Business.topUpCredits` is what the business paid for: top-up purchases INCREMENT it and nothing ever resets it. Replies cost 5 credits on Telegram/Discord/Web Chat and 80 on WhatsApp (`getAiReplyCreditCost`); `chargeAiReply` in `lib/chat-engine.ts` spends `planCredits` first then `topUpCredits` inside a `prisma.$transaction` compare-and-swap (retried up to 3 times), and every gate (`auth-guards`, chat engine, conversations API, UI) sums them with `totalAvailableCredits()`. Manual replies are free. `CREDITS_RESET_DISCLAIMER` (lib/plans.ts) is the exact customer-facing wording. Dashboard header shows plan + credit pills (`components/dashboard/plan-chip.tsx`, total with a plan/top-up tooltip); Plans page is Telegram-first. New signups land on the permanent Free plan (`plan: "free"`, `planStatus: "inactive"`, `planCredits: FREE_PLAN_LIMITS.credits` = 80, `topUpCredits: 0`); the 7-day trial is retired, so legacy rows stored as `trial` / `trialing` are read as Free everywhere. The Free 80 is re-granted lazily by `ensureFreeGrant()` in `lib/credits.ts`: once `Business.lastFreeGrantAt` is more than 30 days old it resets `planCredits` to `FREE_PLAN_LIMITS.credits` and stamps the field, using a compare-and-swap `updateMany` on `plan` + the stale stamp so a concurrent paid upgrade (or a parallel request) is never clobbered, and `topUpCredits` is never touched; it returns the same row with the fresh balance. Callers are `requireAiEnabled()` (lib/auth-guards.ts, before any gate so paused-AI accounts still refresh), `GET /api/billing/usage` (dashboard header pills + billing/credits pages) and the AI dashboard page (`app/(dashboard)/ai/page.tsx`), so the balance refreshes without waiting for an AI reply. There is still no scheduler/cron — nothing happens until one of those reads the wallet.
- Plan expiry: `downgradeExpiredPlan()` (lib/credits.ts) runs first inside `requireAiEnabled()`, before `ensureFreeGrant` and every gate. It demotes a paid row to Free — `plan: "free"`, `planStatus: "inactive"`, `planCredits: 80`, `lastFreeGrantAt: now`, `subscriptionStatus: "inactive"`, dunning fields cleared — when `planExpiresAt` is past AND `planStatus !== "active"` AND any dunning grace has lapsed; `active` rows are never touched (a late renewal webhook must not cut off a paying customer) and the write is a compare-and-swap on `plan` + `planStatus`, so a concurrent renewal wins. It runs first in `requireAiEnabled()` AND at the top of `GET /api/billing/usage`, so the dashboard plan chip and billing pages drop to Free on the next load instead of waiting for an AI reply.
- Auth linking: seeded/demo users have `supabaseUserId` null; signing up with matching email adopts the row. A signed-in session with no tenant throws (not redirect) to avoid login loop.
- Supabase server client cookie writes ignored in Server Components - by design, proxy handles rotation.
- Prisma logs: errors/warns in dev, errors only in prod.
- Business tone defaults/fallbacks: unknown stored tone falls back to "friendly" in prompt building.
- SearchProducts returns max 5 matches; chat returns count/products to model.
- Analytics: the Umami `<Script>` is rendered exactly once, in the root `app/layout.tsx`, so marketing, auth and dashboard routes all report pageviews. Never add another copy in a nested layout/page (the marketing layout used to have one) — pageviews would be counted twice. Custom events go through `trackEvent(name, data)` in `lib/analytics.ts`, which is a safe no-op during SSR or when the script is missing. The `signup` event (`{ role: "business" | "agent" }`) is fired by `components/auth/business-signup-form.tsx` when `signup()` returns the email-verification state, and by the agent form in `app/(auth)/signup/signup-content.tsx`. A business signup that the server action redirects straight to `/dashboard` (email confirmation off) has no client-side success state, so it is pageview-only; covering it needs a marker (cookie or `?welcome=1`) read on the dashboard.
- Next.js 16 experimental flags enabled: `agentFeedback: true`, `cacheComponents: true`, `partialPrefetching: true`. Turbopack configured for CSS. Do not remove the auto-generated Next.js agent rules block.

## Testing / verification

No test scripts defined in package.json. If tests are added later, prefer running single test/package as needed. For changes, verify with `npm run lint`. Type safety checked via TypeScript; no dedicated typecheck script. For chat changes, manually sanity check against seed data (ABC Electronics has Hisense/Samsung etc.) if environment allows.
