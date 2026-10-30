# Colly docs

Internal documentation that does not belong in the product UI.

| File | What it is | Update when |
| --- | --- | --- |
| [`CONTENT_AUDIT.md`](./CONTENT_AUDIT.md) | Register of every stale, wrong or missing piece of documentation, marketing copy, legal text and agent-academy content found in the repo, with the canonical source of truth for each fix. | A stale claim is found or fixed. |
| [`QA_AUDIT_V2.md`](./QA_AUDIT_V2.md) | Engineering QA audit with a live status column (fixed / open / deferred). | An audit item is closed. |
| [`../AGENTS.md`](../AGENTS.md) | Contract for AI agents working in this repo: commands, architecture, conventions, gotchas. | A convention or architectural rule changes. |
| [`../README.md`](../README.md) | Human-facing setup and architecture overview. | Setup steps, env vars or feature scope change. |

## Sources of truth

Never hardcode a fact that already lives in code. Copy it from the canonical module instead:

| Fact | Canonical source |
| --- | --- |
| Plan names, prices, credits, reply cost, reset wording | `lib/plans.ts` |
| Wallet behaviour (free re-grant, plan expiry, spend order) | `lib/credits.ts`, `lib/chat-engine.ts` |
| Channels and their enum values | `prisma/schema.prisma` (`Business.channel`) + `lib/plans.ts` |
| Agent curriculum, quizzes, final exam | `prisma/academy-content.cjs` (validated by `tests/academy-content.test.ts`) |
| API surface | the route tree under `app/api/` |

`npm test` fails when the academy content drifts from `lib/plans.ts` (credit amounts,
plan prices, retired WhatsApp-API claims), so the check is automated rather than
relying on a reviewer noticing.
