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

## Auth (Supabase)

- Server client: `lib/supabase/server.ts` uses `@supabase/ssr` with async `cookies()`; setAll swallows errors in Server Components (proxy refreshes session). Always create per request.
- Browser client: `lib/supabase/client.ts` uses `@supabase/ssr` createBrowserClient.
- Env: `lib/supabase/env.ts` reads `NEXT_PUBLIC_SUPABASE_URL` and either `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (accepts both). Missing config throws explicit error.
- Auth helpers: `lib/auth.ts` - `getCurrentUser()` validates token via `supabase.auth.getUser()` and maps to DB User+Business (prefers `supabaseUserId`, falls back to email on unclaimed rows, links on first match). `getCurrentBusinessId()` returns tenant id or null. `requireAuth()` redirects to `/login` if no session; throws if session exists but no tenant linked (prevents redirect loop). `AuthUser` includes business fields.

## Chat / AI (DeepSeek)

- DeepSeek via OpenAI-compatible SDK: `lib/deepseek.ts`. Model `deepseek-chat`, default base URL `https://api.deepseek.com`, lazy client reads `DEEPSEEK_API_KEY` and optional `DEEPSEEK_BASE_URL`. Overloads: no tools returns `string`, with tools returns full `ChatCompletion`. Throws if empty reply.
- Chat route: `app/api/chat/route.ts`. Accepts `{ businessId?, customerId, message }`; if session present, businessId must match session. Validates customer belongs to business. Reuses latest conversation or creates new (status OPEN). Saves customer message. If conversation.pausedUntil > now, returns `{ reply: null, paused: true }` (human takeover). Loads last HISTORY_LIMIT=20 messages (desc->reverse), builds system prompt via `buildSystemPrompt()` (identity, optional business.description/hours, SYSTEM_PROMPT_RULES, tone last), then loops tool calls up to MAX_TOOL_ROUNDS=2. Tool: `search_products` (defined in TOOLS) - returns up to 5 matches (name, price in Naira, stock, description). After tool rounds, if no text reply, asks once more without tools. Saves AI reply as sender "ai". Tools implementation in same file: `runToolCall()` calls `searchProducts(businessId, query)` from `lib/tools.ts`; `readQuery()` defensively parses JSON args. Sender values stored: "customer", "ai", "agent".
- System prompt constraints (critical): must call search_products for any product/price/stock/availability/spec question (including follow-ups; memory not catalogue). Answer only from tool results; only say "no product" if count==0; only say out of stock if tool shows stock==0. Plain text only (no Markdown/formatting symbols). Never reveal exact stock quantities - only state available/in stock or out of stock/sold out. For multiple products, each on its own line as `Name Price` (no dash/colon/bullet), total on separate line.
- Tone: from Business.tone (validated by `isTone()` from `lib/business.ts`, fallback "friendly"). TONE_INSTRUCTIONS: formal, friendly (light emoji allowed in friendly tone instruction text, but reply must follow plain text rule), pidgin_friendly (Nigerian Pidgin). Tone appended last to bias model.

## Other API routes (high-level)

- `app/api/business/route.ts`: GET returns `{ business, ownerEmail }` for signed-in owner. PATCH updates subset (name/phone/whatsappNumber required if present, tone validated, optional free-text fields stored as null when empty). Scoped to caller's businessId.
- Conversations: `app/api/conversations/route.ts` (list), `[id]/route.ts` (get/update), `[id]/messages/route.ts` (list/add), `[id]/takeover/route.ts` (takeover control).
- Customers: `app/api/customers/route.ts`, `[id]/route.ts`
- Products: `app/api/products/route.ts`, `[id]/route.ts`
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

## Conventions / gotchas

- Keep chat replies plain text only (see SYSTEM_PROMPT_RULES line with extensive formatting ban). Never add Markdown.
- Never reveal exact stock quantities in responses - only availability states.
- Tool calling is mandatory for product questions; chat enforces with explicit rules and follow-up note.
- Human takeover: `conversation.pausedUntil` gates AI replies (returns paused true if active). Agent messages use sender "agent".
- Auth linking: seeded/demo users have `supabaseUserId` null; signing up with matching email adopts the row. A signed-in session with no tenant throws (not redirect) to avoid login loop.
- Supabase server client cookie writes ignored in Server Components - by design, proxy handles rotation.
- Prisma logs: errors/warns in dev, errors only in prod.
- Business tone defaults/fallbacks: unknown stored tone falls back to "friendly" in prompt building.
- SearchProducts returns max 5 matches; chat returns count/products to model.
- Next.js 16 experimental flags enabled: `agentFeedback: true`, `cacheComponents: true`, `partialPrefetching: true`. Turbopack configured for CSS. Do not remove the auto-generated Next.js agent rules block.

## Testing / verification

No test scripts defined in package.json. If tests are added later, prefer running single test/package as needed. For changes, verify with `npm run lint`. Type safety checked via TypeScript; no dedicated typecheck script. For chat changes, manually sanity check against seed data (ABC Electronics has Hisense/Samsung etc.) if environment allows.
