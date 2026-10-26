# QA Audit V2

**Auditor:** Senior QA Engineer / Lead Architect
**Repo:** `colly` (Next.js 16 App Router · Prisma/Postgres · Supabase SSR · DeepSeek→Groq→OpenRouter · Paystack · Telegram/Discord/Web Chat)
**HEAD at audit time:** `82b4fa9 fix: ensure free tier credits refresh on dashboard load` (clean working tree)
**Date:** 2026-10-25

**Method (read-only).** Full static sweep of `app/`, `lib/`, `components/`, `prisma/`, `scripts/`, root config and CI. No code was modified, no commits, no migrations, no seed, no DB writes. `npx tsc --noEmit` → **exit 0**. Runtime paths were traced by hand (no live HTTP traffic was sent; provider payload formats are flagged where they matter).

**Scope map:** 57 API routes · 22 dashboard pages · 60 components · 48 lib modules · 31 migrations.

---

## Status (updated 2026-10-26)

The audit below is a snapshot of `82b4fa9` and is preserved verbatim. This column records
where each item stands now; the detail and the original reasoning stay underneath.

| Audit item | Status |
| --- | --- |
| 🔴 Renewal webhook never re-grants credits / extends the plan / pays commission | **Fixed** — `charge.success` falls through to `recordRenewal()` when there is no local `Transaction`; `invoice.update` success + `invoice.payment_success` also renew. |
| 🔴 `sha512=` prefix on the webhook signature | **Fixed** — `lib/paystack.ts` strips an optional `sha512=` and compares in constant time. |
| 🔴 AI reply delivered without being charged under concurrency | **Fixed** — credits are reserved before `askAI()` and refunded on failure (`refundAiReply`). |
| 🔴 Provider-outage reply charged with no owner alert | **Fixed** — `provider === "fallback"` refunds, returns `ai_unavailable`, and alerts the owner. |
| 🟠 Weekly report never scheduled | **Fixed** — `/api/cron/maintenance` + `.github/workflows/maintenance.yml` (needs `CRON_SECRET`). |
| 🟠 Dashboard assistant unmetered | **Fixed** — metered through `chargeAiReply`, 402 with `LOW_CREDIT_MESSAGE` when the wallet is short. |
| 🟠 Per-process rate limiting | **Open** — still in-memory per instance; needs a shared store (Upstash/Postgres) before scale. |
| 🟠 Public web-chat widget abuse | **Re-verify** — `/api/chat/web` remains public by design; confirm the per-session/business guards before a marketing push. |
| 🟠 Missing vector/trigram index | **Fixed** — `prisma/migrations/20261026000000_qa_indexes` (`pg_trgm`, `product_name_trgm_idx`). |
| 🟠 CSV import is O(n) round-trips | **Open** — batch the writes when a real customer imports thousands of rows. |
| 🟠 Cancelled/expired plans never fall back to Free | **Fixed** — `downgradeExpiredPlan()` runs before every gate. |
| 🟠 `.env.example` vs code drift on Paystack vars | **Open (cosmetic)** — the `PAYSTACK_PLAN_WA_*` entries are legacy; the unified tiers use `PAYSTACK_PLAN_TG_*`. |
| 🟠 SSRF on media URLs + debug endpoints in production | **Fixed** — `isTrustedStorageUrl()` allow-list; no `/api/test*` routes remain. |
| 🟠 `AGENTS.md` materially out of date | **Fixed** — rewritten for the multi-channel/unified-plan product (see `docs/CONTENT_AUDIT.md`). |
| 🟠 Unbounded list endpoints | **Fixed** — one page + optional keyset `cursor` via `lib/pagination.ts`. |
| 🟠 Hot message query has no supporting index | **Fixed** — composite Message/Conversation indexes in the same QA migration. |
| 🟡 Plan grants do not reconcile with 1 credit = ₦1 | **Fixed** — Blue base 25,000, Black base 50,000 (`lib/plans.ts`, asserted by tests). |
| 🟡 Free tier's 50 credits cannot afford one WhatsApp reply | **Fixed** — Free is now 80 credits / 30 days. |
| 🟡 `getCreditPackage()` is a no-op branch | **Open (harmless)** — both packs are 3,000 credits; simplify when the packages diverge. |
| 🟡 `[SILENCE]` handling is an exact string match | **Re-verify** in `lib/chat-engine.ts`. |
| 🟡 Prompt-injection regex too broad and too narrow | **Re-verify** in `lib/chat-engine.ts`. |
| 🟡 Mobile touch targets | **Open** — audit the dashboard buttons against 44px before launch. |
| 🟡 Empty states / client error handling / `console.log` leaks | **Open** — partially addressed; re-sweep `app/(dashboard)` before launch. |
| 🟡 Waitlist endpoint unauthenticated, unthrottled, no dedupe | **Open** — the form now exists (`/settings/ai-line`), so throttle + dedupe before it is promoted. |
| 🟡 Telegram webhook secret derived from the bot token | **Open** — re-check `app/api/telegram/webhook/route.ts` before the next bot rollout. |
| 🟡 Dead WhatsApp-era plan labels | **Re-verify** — `components/dashboard/plan-chip.tsx` now reads the unified tiers; confirm no labels remain. |
| 🟡 Duplicate migration timestamps (`20261024120000`) | **Open** — never rewrite applied migrations; document the ordering in the next migration that touches those tables. |
| 🟡 Modal accessibility | **Open** — backdrop `onMouseDown`, focus trap and Escape handling. |
| 🗑️ Trash files | **Fixed** — `/api/test-db` and the scratch routes are gone. |
| 💡 Pagination, tests, docs | **Added this cycle** — `lib/pagination.ts`, `tests/` + CI, `README`/`AGENTS`/`docs/`. |

---

## 🔴 Critical (Must fix before launch)

- **`app/api/billing/webhook/route.ts` — monthly renewal never re-grants credits, never extends the plan, never pays the referring agent.**
  `charge.success` first runs `transaction.updateMany({ where: { reference, status: "pending" } })`, then `if (claim.count === 0) break;`. Recurring subscription charges have **no local `Transaction` row** (only the checkout routes create them), so `claim.count` is always `0` for a renewal → the handler `break`s **before** the `isSubscription` block that overwrites `planCredits` and clears dunning. The only surviving renewal path is `case "invoice.payment_success"` (line ~349), and **`invoice.payment_success` is not in Paystack's documented event catalogue** — Paystack emits `invoice.create` / `invoice.update` / `charge.success` for recurring charges. `invoice.update` is handled only when `data.status === "failed"`, so a *successful* invoice updates nothing.
  Net effect: every paying customer is granted credits once (at first payment, via `verify` or `charge.success`) and then **never again**; `planExpiresAt` freezes at the first payment date; `subscriptionStatus` can flip to `past_due` on a failed charge but the recovery path never runs; agent commission stops after month 1 despite the "15% for up to 12 months" promise.
  **Fix:** in `charge.success`, when there is no local Transaction (or `claim.count === 0` **and** no row for the reference), do **not** `break` — fall through to the subscription branch, resolve the business with `findBusinessId(data)`, then apply `planCredits: getMonthlyCredits(...)`, `planExpiresAt: addDays(now, interval === "yearly" ? 365 : 30)`, `planStatus/subscriptionStatus: "active"`, and the commission block. Mirror the overwrite on `invoice.update` when `data.status === "success"`. Capture real renewal payloads for one billing cycle before trusting this; add an integration test from a captured payload.

- **`lib/paystack.ts:302-314` — webhook signature is compared with a `sha512=` prefix that Paystack does not send.**
  ```ts
  const expected = `sha512=${createHmac("sha512", getSecretKey()).update(rawBody).digest("hex")}`;
  ```
  Paystack's own integration samples compare the **bare hex digest** from `x-paystack-signature` (`hash_hmac('sha512', $body, $secret) === $header`). If production headers are bare hex, **every** webhook is rejected with 401 → plan activation only via the browser `verify` callback, and renewals/dunning/commissions silently die while Paystack retries for hours.
  **Fix:** normalise before comparing — `const header = signature.replace(/^sha512=/i, "")` — compare the hex digest in constant time, and accept both shapes. Unit-test with a captured header and assert a tampered body fails.

- **`lib/chat-engine.ts:375-455` — an AI reply can be delivered without ever being charged (concurrent free replies).**
  `requireAiEnabled()` is a *check*, not a reservation. Then:
  ```ts
  await prisma.message.create({ ... sender: "ai", content: reply });
  await chargeAiReply(businessId, business.channel);   // result ignored
  ```
  `chargeAiReply()` returns `void` and only `console.warn`s on `"insufficient"` or retry exhaustion. Two messages arriving together both pass the gate with a 5-credit balance, both call the model, both persist a reply — the first debit lands, the second CAS matches 0 rows, re-reads, sees `0 < 5`, and **returns silently**. The customer keeps the free reply. With N concurrent messages a wallet holding one reply's worth of credits yields up to N replies. Any throw inside `chargeAiReply` also aborts after the message row is written (reply persisted, uncharged, HTTP 500).
  **Fix:** reserve first, generate second — `UPDATE "Business" SET planCredits = planCredits - $x, topUpCredits = topUpCredits - $y WHERE id = $1 AND planCredits + topUpCredits >= $cost RETURNING *`; generate only if a row came back; refund (compensating update) on provider failure. Make `chargeAiReply` return `"charged" | "insufficient" | "exhausted"` and require `"charged"` before persisting/sending. Never let a charge failure turn a successful reply into a 500.

- **`lib/ai.ts:212-217` + `lib/chat-engine.ts:347-393` — customers are billed for the "provider outage" message, and nobody is alerted.**
  When all three providers fail, `askAI` returns `{ reply: FALLBACK_REPLY, provider: "fallback" }`. The engine treats it as a normal answer: saves it, charges 5 (or 80) credits, returns `replied: true`. The text says *"Let me get the team to help you"*, but `sendOwnerAlert()` / `escalateConversation()` are never called — only the internal `sendAlert`. The business pays for an apology, the customer is promised a human, and no human is notified.
  **Fix:** branch on `result.provider === "fallback"` in the engine: persist the customer message, `escalateConversation()`, `sendOwnerAlert()`, return `blocked: true` with a new `ai_unavailable` reason, and **do not charge**.

---

## 🟠 High Priority (Should fix)

- **`app/api/reports/weekly/route.ts` — the weekly report never runs.** `CRON_SECRET` *is* strictly required (unset/absent ⇒ 401, correct), but nothing schedules the endpoint: there is no `vercel.json` (confirmed absent) and `.github/workflows/keep-alive.yml` only curls `/api/health`. Shipped-but-dead feature. Add a `vercel.json` cron (`0 6 * * 1`) or a GitHub schedule sending `Authorization: Bearer $CRON_SECRET`; add `export const maxDuration = 300`; batch the 4 per-business counts with `groupBy` instead of running them × N businesses.

- **`app/api/chat/route.ts:96-114` — the dashboard assistant is unmetered and unlimited.** When `isDashboardAssistant` is true the route calls `askAI()` directly: no `requireAiEnabled`, no credit charge, no rate limit, and the flag is trusted from the request body. Any signed-in owner (including a Free account with 0 credits) can loop the floating widget and burn provider tokens indefinitely.
  **Fix:** charge an internal flat cost (or a daily cap), rate-limit per `businessId`, and gate on `requireAiEnabled()`/an owner allowance before calling the model.

- **`lib/rate-limit.ts` — rate limiting is per-process memory keyed on a spoofable header.** `rateLimitMap` lives in module scope: on Vercel each instance/cold start has its own Map, so the effective limit is `limit × instances` and it resets constantly. All three public entry points key on `x-forwarded-for` (`app/api/chat/web/route.ts:65`, `telegram/webhook/route.ts:27`, `discord/webhook/route.ts:50`), which a direct caller controls.
  **Fix:** durable limiter (Upstash Redis / Vercel KV / a Postgres table) keyed on a trusted identity — `businessId` for the widget, `chat.id` for Telegram, guild+user for Discord — with IP only as a secondary signal.

- **`app/api/chat/web/route.ts:115-138` — the public widget can drain credits and bloat the tenant.** Unauthenticated `POST` with a caller-supplied `customerId`; if absent, `crypto.randomUUID()` mints a **new `Customer` row on every request**. Each accepted message can spend 5 of the business's credits. With the in-memory limiter bypassed this is a credit-drain + table-growth vector against any business that embeds the widget.
  **Fix:** signed widget token (HMAC over `businessId` + origin, issued by the settings page), cap new visitors per business per day, verify `Origin` against the configured domain, make the limiter durable.

- **`lib/tools.ts` + `prisma/migrations/*` — product/FAQ search has no vector or trigram index, and relies on an extension that is never enabled.**
  `semanticSearchProducts()` runs `ORDER BY "embedding" <=> $1::vector LIMIT 5` filtered by `businessId`. Migrations enable `CREATE EXTENSION IF NOT EXISTS vector` but **never create `ivfflat`/`hnsw`** on `Product.embedding` / `Faq.embedding` (grep over `prisma/migrations/*.sql`: only the extension + column type changes exist). So Postgres sequential-scans the table — all tenants, 1024 dims per row — on every tool call (up to 2 rounds per reply). On a 10,000-product catalogue that is ~10k × 1024 float ops per search, scaling with *global* catalogue size rather than the tenant's.
  Worse, `trigramSearchProducts()` calls `similarity("name", $1)` (a `pg_trgm` function) but **`pg_trgm` is created in no migration**, and there is no GIN trigram index on `"Product"."name"`. If the extension is missing the query throws, is caught, and silently degrades to `ILIKE '%term%'` (no typo tolerance, no index) — `lib/tools.ts:510-536`.
  **Fix:** one migration: `CREATE EXTENSION IF NOT EXISTS pg_trgm;` + `CREATE INDEX product_name_trgm_idx ON "Product" USING gin ("name" gin_trgm_ops);` + `CREATE INDEX product_embedding_idx ON "Product" USING hnsw ("embedding" vector_cosine_ops);` (+ equivalents on `Faq`), then `ANALYZE`. Keep the `businessId` predicate before the `ORDER BY` and tune `hnsw.ef_search`.

- **`app/api/products/import/route.ts:68-118` — CSV import is O(n) round-trips, unbounded, and fire-and-forget.** A `findFirst` per row, then a `create`, then `void reembedProduct(...)` per row (one outbound embedding call each). A 2 MB CSV is ~20k rows ⇒ 20k SELECTs + 20k INSERTs + 20k background embedding calls from one request. On serverless this times out mid-import (partial data, no resumability) and can swamp the embedding provider.
  **Fix:** read names once, `findMany` the existing set, `createMany({ skipDuplicates: true })` in chunks, cap at ~500–1,000 rows per request with a clear error, enqueue embeddings on a job runner (or one batched embed call), and return `{ imported, duplicates, errors }` with an explicit "retry remaining" contract.

- **`lib/credits.ts` + `lib/auth-guards.ts` — cancelled/expired paid plans never fall back to Free, and `planExpiresAt` is never enforced.**
  Cancelling only sets `planStatus: "cancelled"` (`app/api/billing/cancel/route.ts`); `Business.plan` stays `green|blue|black`, so `ensureFreeGrant()`'s `FREE_PLAN_NAMES.includes(business.plan)` is false forever. Meanwhile `requireAiEnabled()` checks `aiEnabled`, `subscriptionStatus === "past_due"` and the wallet — **never `planStatus` and never `planExpiresAt`** (grep: `planExpiresAt` is read only by `cancel`, `usage` and the billing UI). A lapsed yearly plan keeps replying while credits remain; a cancelled plan that runs dry goes permanently silent instead of dropping to Free 50.
  **Fix:** add `downgradeExpiredPlans()` (or extend `ensureFreeGrant`) flipping `plan → "free"` when `planExpiresAt < now() && planStatus !== "active"`, then grant; check `planExpiresAt` in `requireAiEnabled`; keep the CAS so a concurrent renewal never gets clobbered.

- **`.env.example` vs `.env` — the documented Paystack plan variables are not the ones the code reads.** `app/api/billing/checkout/route.ts:19-40` reads `PAYSTACK_PLAN_GREEN_M|_Y`, `BLUE_M|_Y`, `BLACK_M|_Y` (which `.env` defines ✔). `.env.example` ships `PAYSTACK_PLAN_TG_GREEN_M…`, `PAYSTACK_PLAN_WA_STARTER_*`, `BUSINESS_*`, `PRO_*` instead — a fresh deploy copying the example fails every subscription checkout with *"Paystack Plan Code missing for green monthly"*. `.env.example` also omits `JINA_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `DISCORD_PUBLIC_KEY`; `.env` omits `NEXT_PUBLIC_APP_URL`, `CHAT_INTERNAL_SECRET`, `CRON_SECRET`, `RESEND_API_KEY` (local internal-secret calls are rejected, weekly email skipped, cron 401s).
  **Fix:** single typed config module (`lib/env.ts`, zod) that both runtime and docs derive from; fail fast at boot instead of at checkout.

- **SSRF on media URLs + debug endpoints live in production.** `lib/stt.ts:181-206` (`fetch(audioUrl)`) and the equivalent vision path download **any** URL server-side. Reachable from `app/api/voice/test` and `app/api/vision/test` (live in prod, `requireAuth()` only, no rate limit, no credit charge — they spend Groq/Jina money freely) and from `app/api/chat` with `audioUrl`/`imageUrl`. A signed-in owner can make the server fetch `http://169.254.169.254/…` or an internal admin endpoint.
  **Fix:** delete both `/test` routes (or gate on `NODE_ENV !== "production"` + an admin allowlist) and constrain media URLs to the Supabase storage host — https only, no redirects, resolve and reject private/link-local IPs.

---

- **`AGENTS.md` is materially out of date — an agent following it will write broken code.**
  It documents `lib/deepseek.ts` (now `lib/ai.ts` with a DeepSeek→Groq→OpenRouter chain), `HISTORY_LIMIT=20` (code: 10), channels `WHATSAPP|TELEGRAM` (now `TELEGRAM|DISCORD`, `lib/business.ts:16`), the 7-day trial (retired), `getPaystackPlanCode()` in `lib/plans.ts` (it lives in `app/api/billing/checkout/route.ts`), `app/api/test-db/route.ts` (gone), a `search_products`-only tool set (now 4 tools incl. `escalate_to_owner`), and a plain-text formatting rule the current prompt no longer contains. It never mentions negotiation, invoices, sales, agents/academy, web chat, or the migration history.
  **Fix:** update `AGENTS.md` in the same PR as each behaviour change (or generate its command/schema sections), and add a CI check that fails when a documented path no longer exists.

- **Unbounded list endpoints (will fall over at 10k rows).** `app/api/conversations/route.ts:20-30` loads **every** conversation plus one message each and sorts in JavaScript; `app/api/products`, `app/api/invoices`, `app/api/faqs` and `app/api/sales` have no `take`/`skip` at all (grep: `take` appears only inside `messages: { take: 1 }`). The dashboard then renders all of them.
  **Fix:** keyset pagination (`take: 50`, `cursor`) everywhere; denormalise `Conversation.lastMessageAt` and `ORDER BY "lastMessageAt" DESC` in SQL so the inbox stops sorting the world in memory.

- **`prisma/schema.prisma:341-372` — the hot message query has no supporting index.** History is `where { businessId, conversationId } orderBy { createdAt: "desc" } take: 10`; the table has `@@index([businessId])` and `@@index([conversationId])` only, so Postgres still sorts the whole thread. Monthly usage counts filter `businessId + sender + createdAt`.
  **Fix:** `@@index([conversationId, createdAt])` and `@@index([businessId, sender, createdAt])`.


---

## 🟡 Medium Priority (Polish / UX)

- **`lib/plans.ts:110-135` — plan grants do not reconcile with "1 credit = ₦1".** `green`: ₦15,000 → `baseCredits: 15_000` (+8,000 bonus) ✔. `blue`: **₦25,000 → `baseCredits: 28_000`** (+16,000) — ₦3,000 of credit is given away before the bonus. `black`: **₦50,000 → `baseCredits: 60_000`** (+40,000) — ₦10,000 given away. Yearly is 10× monthly for 12 months (fine), but `NAIRA_PER_CREDIT = 1` and the top-up packs sell at face value, so the "1 credit = ₦1" promise on the credits page contradicts the plan table by 12–20 %. Either raise prices to match `baseCredits`, or rename the unit ("₦1 of AI spend") and stop implying parity. The code comments ("`baseCredits` (what the price pays for)") are also wrong for blue/black.

- **`lib/plans.ts:160` + `lib/auth-guards.ts:90` — the Free tier's 50 credits cannot afford a single WhatsApp reply (80).** Any legacy row with `channel = "WHATSAPP"` gets a permanently dead AI while the dashboard shows "50 credits available". New businesses can't hit this (`CHANNELS = ["TELEGRAM","DISCORD"]`), but legacy rows will.
  **Fix:** migrate legacy `WHATSAPP` rows to a supported channel or raise the Free grant to ≥80, and show "not enough for one reply" instead of a green balance.

- **`lib/plans.ts:280-287` — `getCreditPackage()` is now a no-op branch.** `free_credits` and `paid_credits` are both 3,000 credits / ₦3,000, so `isActivePaidPlan()` decides nothing. Either offer a different paid pack (the original intent) or delete the branch and the type union.

- **`lib/chat-engine.ts:369-373` — `[SILENCE]` handling is an exact string match.** Models routinely emit `[SILENCE].`, `[silence]`, or a short sentence around the token; only the bare token is caught. Any variant is saved as a customer-visible AI reply (and charged).
  **Fix:** normalise before comparing — `reply.replace(/[\s.!]+$/,"").toUpperCase() === "[SILENCE]"`, or better, treat a dedicated tool call / `finish_reason` flag as the signal.

- **`lib/chat-engine.ts:79-81` — the prompt-injection regex is both too broad and too narrow.** `/act\s+as|you\s+are\s+now/i` fires on benign messages ("you are now in Lagos", "can you act as a courier?", "do you have the Act as amended") and then escalates the conversation and sends a canned reply **without any AI** — a false escalation for a paying customer. Conversely "disregard your rules", "repeat your prompt", or base64-wrapped instructions sail through.

- **Mobile touch targets — only 3 `min-h-[44px]` declarations vs 85 `<button>` elements in `app/(dashboard)` + `components`.**
  `components/ui/button.tsx:30` enforces 44 px ✔, and `MobileNav` uses `min-h-[56px]` ✔, but most icon/action buttons are below the 44 px guideline: `app/(dashboard)/products/page.tsx:480-497` (`ActionButtons`, `p-2` ⇒ ~32×32), the FAQ equivalents (`faqs/page.tsx:477+`), `components/ui/modal.tsx:64-71` (close, `p-1` ⇒ ~28×28), `components/dashboard/dashboard-shell.tsx:140-147` (hamburger `p-1.5` ⇒ ~30×30), and the `PlanChip` pills (`py-1.5` ⇒ ~32 px tall).
  **Fix:** add `min-h-[44px] min-w-[44px]` (or an `after:absolute after:-inset-1.5` hit-area extender) to every icon button; keep the visual size with padding so the layout doesn't shift.

- **Empty states are inconsistent and two are factually wrong about the channel.**
  - `app/(dashboard)/customers/page.tsx:75` — *"No customers yet. When someone messages your **WhatsApp**, they'll appear here."* WhatsApp is retired (`lib/business.ts:16` only exposes `TELEGRAM | DISCORD`); a new owner waits for a channel that isn't connected and never opens Telegram.
  - `app/(dashboard)/conversations/page.tsx:37` — same WhatsApp copy.
  - Customers / conversations / invoices empty states have **no CTA** (plain dashed box, `customers/page.tsx:208-214`, `conversations/page.tsx:202-210`, `invoices/page.tsx:281-288`). Products does it right (`products/page.tsx:252-305`: 4-step quick start + "Add Product"); FAQs renders a single gray paragraph (`faqs/page.tsx:303-305`) even though `PRESET_FAQS` quick-start cards exist.
  **Fix:** one shared `<EmptyState icon title body cta>` component, channel-neutral copy ("When a customer messages your AI line…"), and a CTA that maps to the actual next step (Connect Telegram · Add product · Record a sale). Add a "How do customers reach me?" link on the two channel-related ones.

- **Client error handling is inconsistent, and one path fakes a zero balance.** List loads throw away the server's `{ error }` and show raw status text (`products/page.tsx:57-59` → *"Request failed with status 500"*, same pattern in customers/faqs/conversations/invoices). `components/dashboard/plan-chip.tsx:31-53` swallows every error **and** derives `balance = usage?.creditBalance ?? 0`, so a failed `/api/billing/usage` renders a red **"0 credits"** pill — indistinguishable from a drained wallet. `dashboard-shell.tsx:68-70` also swallows silently.
  **Fix:** parse `{ error, detail }` on non-2xx and surface it in the banner; add a Retry button; treat `usage === null` as *unknown* (skeleton / "—"), never as 0; log the failure to the same place server errors go.

- **`console.log` in production paths leaks customer content and identifiers.** 8 statements ship: `lib/chat-engine.ts:569` (`escalate_to_owner` business id + reason), `lib/owner-alerts.ts:128` (owner Telegram chat id), `:136`, `:178` (**the customer's full message**), `:79` (chat id), `lib/tools.ts:307` (every Pidgin translation of customer text), `lib/ai.ts:193` (every provider success), `lib/alerts.ts:43`. Vercel log retention + anyone with log access = PII exposure.
  **Fix:** a tiny structured logger (`lib/log.ts`) that redacts `chatId`, `message`, `token`, and is level-gated (`LOG_LEVEL=info` in prod), then replace `console.*` wholesale. Keep `console.error` for real failures only.

- **`app/api/waitlist/route.ts` — unauthenticated, unthrottled, no dedupe.** Any script can insert unlimited `WhatsappWaitlist` rows (no unique constraint, no rate limit, no captcha). Add a unique index on `whatsappNumber`, a per-IP limit, and normalise the number before insert.

- **`app/api/telegram/webhook/route.ts:54-82` — the secret is derived from the token that already sits in the URL.** `telegramVerifyToken = base64url(botToken)` is deterministic, so the header adds no entropy beyond the query token (which leaks into access logs, proxies and Referer chains). The rate limiter also runs *before* the token check, so bogus traffic can exhaust the IP bucket for real updates.
  **Fix:** generate a random `telegramWebhookSecret` per business at connect time, store it, and register *that* as Telegram's `secret_token`; move the limiter after authentication and key it on `chat.id`/`businessId`.

- **`components/dashboard/plan-chip.tsx:18-26` + `components/dashboard/dashboard-shell.tsx:52-64` — dead WhatsApp-era code.** `PLAN_LABELS` still maps `starter/business/pro`; `DashboardShell` fetches `/api/business` and reads `whatsappConnected`, a field `serializeBusiness()` no longer returns, so the `Setup Pending` chip logic is effectively always `telegramConnected || discordConnected` via a second round-trip that can be removed (the layout already passes `hasNoChannels`).

- **`prisma/migrations` — two folders share the timestamp `20261024120000`** (`…_add_customer_deal_status`, `…_add_deal_status_and_dunning`). Prisma orders by folder name so deploys are deterministic today, but a fresh `migrate deploy` on an empty DB replays both and any column overlap (both add `dealStatus`) will fail. Consider squashing into one migration and re-baselining before launch.

- **Accessibility / modal a11y.** `components/ui/modal.tsx` closes on backdrop `onMouseDown` (accidental close when a text selection drags out), has no focus trap, no initial focus, and no focus restore on close; the title is an `aria-label` but there is no `aria-labelledby` reference. Add `focus-trap`, `initialFocus`, and restore focus to the trigger.

---

## ✅ Explicitly verified as sound (so you don't re-audit it)

- **Split-wallet math is correct where it runs.** `splitCreditCost()` spends `planCredits` first (`min(plan, cost)`) and only bills `topUpCredits` for the remainder; `totalAvailableCredits()` is the gate everywhere; `chargeAiReply()` decrements both buckets in one CAS `$transaction` with `messagesUsedThisMonth` / `aiMessagesUsed`; a lost race re-reads and retries 3×. Top-ups `increment` `topUpCredits` in **both** `verify` (`app/api/billing/verify/route.ts:151-159`) and the `charge.success` webhook, and both are idempotent via the `pending → success` claim (a webhook-first finish leaves `verify` returning the settled wallet). Renewal *does* `SET` (not increment) `planCredits` and never touches `topUpCredits` in both surviving code paths — the flaw is that those paths don't fire (Critical #1), not the arithmetic.
- **Credit constants match the brief:** `REPLY_CREDIT_COSTS = { standard: 5, whatsapp: 80, manual: 0 }`, `NAIRA_PER_CREDIT = 1`, top-up pack 3,000 credits = ₦3,000, `amountKobo = amountNaira * 100`.
- **`ensureFreeGrant()` has no timezone bug and no unlimited-credit path.** It compares absolute epoch ms (`Date.now() - 30d`) against a `timestamptz`-backed `Date`, so DST/UTC offsets cannot shift the window; the grant is a `REPLACE` (not an add), so refreshing cannot stack; the `updateMany` CAS on `plan IN (free,trial)` + stale stamp means concurrent readers can only grant once, and a paid upgrade that lands mid-check is never clobbered. The only defects are the *loss* cases (cancelled/expired plans never fall back — High priority) and the lack of a `lastFreeGrantAt` write-back on the lost-CAS branch (harmless: the caller returns the fresh row).
- **No horizontal overflow found.** The three `<table>`s (`products`, `customers`, `invoices`) are all wrapped in `hidden … md:block` with card layouts for mobile, and the shell is `overflow-x-hidden` + `max-w-full`. The single `overflow-x-auto` is the top bar, with a real `no-scrollbar` utility (`app/globals.css:272`) and `pb-safe` for the bottom nav. Only the touch-target sizes (Medium) need work.
- **Discord webhook signature verification is correct** — Ed25519 over `timestamp + rawBody` with `DISCORD_PUBLIC_KEY`, hex-decoded, in `try/catch` (`app/api/discord/webhook/route.ts:171-188`), and it rejects before parsing.
- **`CRON_SECRET` is strictly required** — the route returns 401 unless `process.env.CRON_SECRET` exists and the `Authorization` header equals `Bearer <secret>` (`app/api/reports/weekly/route.ts:102-108`). It cannot be bypassed by omitting the env var.
- **Tenant scoping is consistent** on the routes I traced: `getCurrentBusinessId()` + `where: { id, businessId }` on conversations/messages/takeover, `conversation.findFirst({ id, businessId })` before any write, and `/api/chat` verifies `customer.businessId` before grafting a message. No cross-tenant read/write path found.
- **No unused components.** All 60 files under `components/` resolve to at least one import (including `agents/agent-sidebar` → `agents/agent-shell`); `ui/tilt-card`, `smooth-scroll`, `splash-screen`, `stat-card`, `animated-counter`, `top-loader`, `scroll-reveal`, `skeleton`, `quantity-control` are all referenced. There is no leftover 3D/UI-kit dead weight.
- **`npx tsc --noEmit` → exit 0** on the current tree.

---

## 🗑️ Trash Files to Delete

- **`.aider.chat.history.md`** (257 KB, root) — full AI-assistant transcript, including pasted code and possibly keys. Gitignored via `.aider*`, but it sits in the project and gets picked up by search/indexing tools. Delete.
- **`.aider.input.history`** (9.9 KB, root) — same, raw prompts typed into the editor. Delete.
- **`.aider.tags.cache.v4/`** (root) — aider's repo-tag cache; regenerated on demand. Delete.
- **`tsconfig.tsbuildinfo`** (362 KB, root) — TypeScript incremental build artifact (`*.tsbuildinfo` is already gitignored). Delete; it is rebuilt on the next `tsc`.
- **`scripts/test-negotiation.ts`**, **`scripts/test-search.mjs`** — ad-hoc manual probes with no runner, no assertions and no `npm` script. Either move to a real `tests/` setup (vitest) or delete; right now they look like production code and invite accidental execution against the live DB.
- **`scripts/restore-academy-quizzes.cjs`** (13.7 KB) — one-off data-restore patch for the academy. If the incident is closed, delete; if it must stay, move it to `prisma/patches/` with a dated README and a hard `--confirm` flag (it currently runs on import of the module graph).
- **`.env` / `.env.local`** (3.0 KB / 3.1 KB) — correctly gitignored and untracked (only `.env.example` is in git ✔). Keep locally, but **rotate `SUPABASE_SERVICE_ROLE_KEY`**: it is present in `.env` and no code reads it (`git grep process.env` confirms), so it is an unused, full-privilege credential on a developer machine.
- **`app/api/vision/test/route.ts`** and **`app/api/voice/test/route.ts`** — debug endpoints that spend real provider money and fetch arbitrary URLs. Delete (see High priority SSRF item).
- **`AGENTS.md`** — not trash, but the stale sections (see High) should be rewritten rather than extended; treat the old text as deleted.
- **`.next/`** — build output, gitignored and reproducible. Safe to wipe before packaging.

---

## 💡 Architect Suggestions

1. **Replace the two mutable credit columns with an append-only ledger + reservation, and make every charge idempotent.**
   `Business.planCredits` / `topUpCredits` cannot answer "why is this balance wrong?" and, as Critical #3 shows, a check-then-debit pair is not a spend. Add `CreditLedger(id, businessId, delta, bucket, reason, refType, refId UNIQUE, createdAt)` and derive the balances (or keep the columns as a cache updated by the same transaction). Spend with `INSERT … ON CONFLICT (refId) DO NOTHING` + `UPDATE Business SET … WHERE planCredits + topUpCredits >= $cost RETURNING *`; refund with an inverse ledger row when the provider fails; add `CHECK (planCredits >= 0 AND topUpCredits >= 0)`. This gives per-reply idempotency (retried webhooks can't double-charge), auditability for support, refunds without manual SQL, and removes the `messagesUsedThisMonth` / `aiMessagesUsed` / `manualMessagesUsed*` denormalised counters (already drifting, since manual replies increment two of them and the AI path increments the other two).
   *Payoff:* kills the free-reply race, makes revenue reconcilable against Paystack, and lets finance answer "what did we sell" without grep.

2. **Introduce a channel-adapter layer + durable queue for inbound messages.**
   Today `handleIncomingMessage()` runs inline inside Telegram's webhook (with a code comment admitting the timeout risk), inside Discord's `after()`, and inside the public web-chat request — three different latencies, three different failure modes, all sharing ~500 lines of engine. Define `Channel` adapters (`verify(req) → payload`, `parse(payload) → {businessId, conversationKey, text, media}`, `send(reply)`), persist an `InboundEvent` row keyed by `(channel, providerMessageId)` **UNIQUE**, ack immediately, and let a worker (QStash/Inngest/pg-boss) call the engine with retries + DLQ. Telegram retries, Discord's 3-second budget and Vercel function timeouts all stop being product-level concerns, and "did the customer get a reply?" becomes a queryable state instead of a log line.

3. **Harden the data layer for a 10k-catalogue/10k-conversation tenant before the first big customer.**
   Concretely: composite indexes (`Conversation(businessId, lastMessageAt)`, `Message(conversationId, createdAt)`, `Message(businessId, sender, createdAt)`), a denormalised `Conversation.lastMessageAt`, keyset pagination on every list endpoint, the pgvector/`pg_trgm` indexes from the High-priority item, and a Prisma client extension that injects `businessId` into every `where` for tenant models (so a missed scoping line is a type/runtime error, not a data leak). Pair it with a load test: seed 10k products for one business and assert p95 chat reply latency and product-search latency budgets.

4. **Standardise the API edge and make the config self-validating.**
   One `apiHandler({ auth, schema, rateLimit, handler })` wrapper would have prevented half of this report: every route would get `getCurrentBusinessId()`-style auth, zod body validation, a durable limiter, a `{ error, detail }` envelope that never leaks stack traces, and a redacting logger. Add `lib/env.ts` (zod, parsed once at boot, same schema generating `.env.example`) so a missing Paystack plan code or `CRON_SECRET` fails the deploy instead of a customer's checkout. Finish with provider contract tests (captured Paystack/Telegram/Discord payloads), `npm run lint` + `tsc --noEmit` + unit tests in CI, and Sentry on `askAI` fallbacks / webhook 401s.

---

### Suggested order of work (highest risk removed first)

1. Fix Paystack signature normalisation and prove it with a captured header (Critical #2) — without this, nothing else in billing is trustworthy.
2. Fix renewal handling (`charge.success` fallthrough + `invoice.update` success) and replay one real renewal payload (Critical #1).
3. Reserve-and-charge credits before generating; refuse to send an uncharged reply (Critical #3).
4. Stop charging for `provider === "fallback"` and escalate instead (Critical #4).
5. Delete the `/test` routes, lock media URLs to the storage host, and add the pgvector/trgm indexes + pagination (High).
6. Fix the copy (WhatsApp empty states), touch targets and the "0 credits on fetch failure" pill (Medium).
7. Delete the aider/build artifacts, rewrite `AGENTS.md`, add CI (Trash + High).

*No files were modified during this audit other than creating this report.*
