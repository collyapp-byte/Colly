import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import {
  LOW_CREDIT_MESSAGE,
  getAiReplyCreditCost,
  getPlanLimits,
  totalAvailableCredits,
} from "@/lib/plans";
import { ensureFreeGrant } from "@/lib/credits";
import { TransactionRow } from "@/components/dashboard/transaction-row";
import Link from "next/link";
import { MessageSquare } from "lucide-react";

export default async function CollyAIPage() {
  // Keep this page dynamic: it renders per-owner data (plan, usage, credits,
  // transactions) that must never be statically frozen. Date rendering lives
  // in the client-only <TransactionRow /> so no clock value is read during
  // prerendering.
  await connection();

  const user = await requireAuth();
  const business = await prisma.business.findUnique({
    where: { id: user.businessId },
    select: {
      id: true,
      tone: true,
      ownerTelegramChatId: true,
      telegramBotToken: true,
      discordBotToken: true,
      planCredits: true,
      topUpCredits: true,
      lastFreeGrantAt: true,
      plan: true,
      planInterval: true,
      channel: true,
    },
  });

  // "This month" is counted from the Message table so it always matches the
  // inbox; the denormalised counters on Business are not month-scoped anymore.
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [productsCount, faqsCount, transactions, aiRepliesThisMonth, manualRepliesThisMonth] =
    await Promise.all([
      prisma.product.count({ where: { businessId: user.businessId } }),
      prisma.faq.count({ where: { businessId: user.businessId } }),
      prisma.transaction.findMany({
        where: { businessId: user.businessId },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          id: true,
          createdAt: true,
          amount: true,
          type: true,
          status: true,
          reference: true,
        },
      }),
      prisma.message.count({
        where: {
          businessId: user.businessId,
          sender: "ai",
          createdAt: { gte: startOfMonth },
        },
      }),
      prisma.message.count({
        where: {
          businessId: user.businessId,
          sender: "agent",
          createdAt: { gte: startOfMonth },
        },
      }),
    ]);

  // Credit Economy figures from the same source of truth the billing API uses
  // (lib/plans.ts): 1 credit = ₦1, and one AI reply costs 5 credits on
  // Telegram/Discord/Web Chat and 80 on WhatsApp. Manual replies are free.
  //
  // Free tier: this page renders the wallet itself, so hand out the monthly 50
  // credits here too. The header pills get theirs from /api/billing/usage; doing
  // it in both places means a Free owner never sees a drained balance just
  // because the AI has not been used for 30 days.
  if (business) {
    await ensureFreeGrant(business);
  }

  const limits = getPlanLimits(
    business?.plan ?? "free",
    business?.planInterval ?? "monthly",
  );
  const planCredits = business?.planCredits ?? 0;
  const topUpCredits = business?.topUpCredits ?? 0;
  // Split wallet: the AI can spend the monthly allowance plus permanent top-ups.
  const creditBalance = totalAvailableCredits({ planCredits, topUpCredits });
  const aiReplyCost = getAiReplyCreditCost(business?.channel);
  const aiUsed = aiRepliesThisMonth;
  const manualUsed = manualRepliesThisMonth;
  // The Free tier includes 80 credits every month, so "Free" is decided by the
  // plan name rather than by a zero credit grant.
  const isFreePlan = (business?.plan ?? "free") === "free";
  const tone = business?.tone === "formal" ? "Formal" : "Friendly";
  const ownerAlertsActive = Boolean(business?.ownerTelegramChatId);
  const telegramConnected = Boolean(business?.telegramBotToken);
  const discordConnected = Boolean(business?.discordBotToken);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-main">Colly AI</h1>
          <p className="mt-1 text-sm text-muted">
            Your AI control center for tone, channels, usage, and knowledge.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="inline-flex items-center rounded-full border border-green-200 bg-green-100 px-3 py-1 text-xs font-medium text-green-700 whitespace-nowrap">
            Active
          </span>
          {ownerAlertsActive && (
            <span className="inline-flex items-center rounded-full border border-green-200 bg-green-100 px-3 py-1 text-xs font-medium text-green-700 whitespace-nowrap">
              Owner Alerts: Active
            </span>
          )}
        </div>
      </div>

      {!ownerAlertsActive && (
        <Link
          href="/settings/ai-line"
          className="mb-5 flex items-start gap-3 rounded-xl border border-colly/30 bg-colly-tint p-4 shadow-sm transition-all duration-250 hover:-translate-y-px hover:shadow-md active:translate-y-0 active:scale-[0.995]"
        >
          <span className="mt-0.5 text-lg" aria-hidden>
            ⚠️
          </span>
          <span>
            <span className="block font-semibold text-colly">
              Action Required: Setup Owner Notifications
            </span>
            <span className="mt-0.5 block text-sm text-[#9A3412]">
              The AI will pause when it hits a limit, but you won&apos;t receive
              an alert. Setup now &rarr;
            </span>
          </span>
        </Link>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* AI Persona */}
        <section className="surface-card surface-card-interactive relative group p-5">
          {/* Stretched link: the whole card opens the tone settings. It sits at
              z-0 so the real buttons below (z-10) stay clickable on top of it. */}
          <Link href="/settings" className="absolute inset-0 z-0">
            <span className="sr-only">View</span>
          </Link>
          <h2 className="font-display text-base text-main">AI Persona</h2>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center rounded-full border border-card-border bg-surface-muted px-3 py-1 text-xs font-medium text-main">
              Tone: {tone}
            </span>
            <span className="inline-flex items-center rounded-full border border-[#FF6600]/20 bg-colly-tint px-3 py-1 text-xs font-medium text-[#FF6600]">
              Adaptive Language: Auto-detects English & Pidgin
            </span>
          </div>
          <div className="mt-4">
            <Link
              href="/settings"
              className="relative z-10 inline-flex items-center justify-center rounded-xl border border-card-ring bg-card-surface px-4 py-2 text-sm font-medium text-main shadow-sm transition-all duration-250 hover:-translate-y-0.5 hover:border-colly/40 hover:shadow-md active:translate-y-0 active:scale-[0.98]"
            >
              Edit Tone
            </Link>
          </div>
        </section>

        {/* Connected Apps */}
        <section className="surface-card surface-card-interactive relative group p-5">
          {/* Stretched link: the whole card opens the AI Line settings. Each
              per-channel button below is z-10 so it keeps its own destination. */}
          <Link href="/settings/ai-line" className="absolute inset-0 z-0">
            <span className="sr-only">View</span>
          </Link>
          <h2 className="font-display text-base text-main">
            Connected Apps
          </h2>
          <div className="mt-4 flex flex-col gap-4">
            <div className="surface-panel flex flex-wrap items-center justify-between gap-3 p-3">
              <div>
                <p className="text-sm font-medium text-main">Telegram</p>
                <p className="text-xs text-muted">Customer-facing bot</p>
              </div>
              <div className="flex items-center gap-2">
                {telegramConnected ? (
                  <span className="inline-flex items-center rounded-full border border-green-200 bg-green-100 px-2.5 py-0.5 text-[11px] font-medium text-green-700 whitespace-nowrap">
                    Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-card-border bg-surface-muted px-2.5 py-0.5 text-[11px] font-medium text-muted whitespace-nowrap">
                    Disconnected
                  </span>
                )}
                <Link
                  href="/settings/ai-line"
                  className="relative z-10 inline-flex items-center rounded-xl border border-card-ring bg-card-surface px-3 py-1.5 text-sm font-medium text-main shadow-sm transition-all duration-250 hover:-translate-y-0.5 hover:border-colly/40 hover:shadow-md active:translate-y-0 active:scale-[0.98]"
                >
                  Manage
                </Link>
              </div>
            </div>
            <div className="surface-panel flex flex-wrap items-center justify-between gap-3 p-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-medium text-main">
                  <MessageSquare
                    className="h-4 w-4 shrink-0 text-muted"
                    aria-hidden
                  />
                  Discord
                </p>
                <p className="text-xs text-muted">Customer-facing bot</p>
              </div>
              <div className="flex items-center gap-2">
                {discordConnected ? (
                  <span className="inline-flex items-center rounded-full border border-green-200 bg-green-100 px-2.5 py-0.5 text-[11px] font-medium text-green-700 whitespace-nowrap">
                    Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-card-border bg-surface-muted px-2.5 py-0.5 text-[11px] font-medium text-muted whitespace-nowrap">
                    Disconnected
                  </span>
                )}
                <Link
                  href="/settings/ai-line"
                  className="relative z-10 inline-flex items-center rounded-xl border border-card-ring bg-card-surface px-3 py-1.5 text-sm font-medium text-main shadow-sm transition-all duration-250 hover:-translate-y-0.5 hover:border-colly/40 hover:shadow-md active:translate-y-0 active:scale-[0.98]"
                >
                  {discordConnected ? "Manage" : "Connect Discord"}
                </Link>
              </div>
            </div>
            <div className="surface-panel flex flex-wrap items-center justify-between gap-3 p-3">
              <div>
                <p className="text-sm font-medium text-main">Web Chat</p>
                <p className="text-xs text-muted">
                  AI replies to website visitors.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-green-200 bg-green-100 px-2.5 py-0.5 text-[11px] font-medium text-green-700 whitespace-nowrap">
                  Active
                </span>
                <Link
                  href="/settings/web-chat"
                  className="relative z-10 inline-flex items-center rounded-xl border border-card-ring bg-card-surface px-3 py-1.5 text-sm font-medium text-main shadow-sm transition-all duration-250 hover:-translate-y-0.5 hover:border-colly/40 hover:shadow-md active:translate-y-0 active:scale-[0.98]"
                >
                  Get Embed Code
                </Link>
              </div>
            </div>


          </div>
        </section>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Credits & Usage */}
        <section className="surface-card surface-card-interactive relative group p-5">
          {/* Stretched link: the whole card opens the credits page. "Top Up" and
              "Upgrade" below are z-10 so they keep their own destinations. */}
          <Link href="/settings/billing/credits" className="absolute inset-0 z-0">
            <span className="sr-only">View</span>
          </Link>
          <h2 className="font-display text-base text-main">
            Credits & Usage
          </h2>
          <div className="mt-4 space-y-4">
            <div className="surface-panel p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">Credit balance</span>
                <span className="font-semibold text-main">
                  {creditBalance.toLocaleString()} credits
                </span>
              </div>
              {/* Split wallet: the two buckets that make up the total. */}
              <div className="mt-2 space-y-1 border-t border-card-border pt-2 text-xs text-muted">
                <div className="flex items-center justify-between">
                  <span>Plan credits (monthly)</span>
                  <span className="font-medium text-main">
                    {planCredits.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Top-up credits (never expire)</span>
                  <span className="font-medium text-main">
                    {topUpCredits.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted">
              {limits.credits > 0
                ? `${limits.credits.toLocaleString()} credits are included with your plan each billing month.`
                : "Your plan does not add credits — top up to keep the AI replying."}{" "}
              1 credit = ₦1. An AI reply costs {aiReplyCost} credits on this
              channel; manual replies are free.
            </p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">AI replies this month</span>
              <span className="font-medium text-main">
                {aiUsed.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Manual replies this month</span>
              <span className="font-medium text-main">
                {manualUsed.toLocaleString()}
              </span>
            </div>
            {creditBalance < aiReplyCost && (
              <p className="rounded-lg border border-[#FF6600]/30 bg-colly-tint px-3 py-2 text-sm text-colly">
                {LOW_CREDIT_MESSAGE}
              </p>
            )}
            {isFreePlan && (
              <p className="rounded-lg border border-[#FF6600]/30 bg-colly-tint px-3 py-2 text-sm text-colly">
                You are on the Free plan.{" "}
                <Link
                  href="/settings/billing/plans"
                  className="relative z-10 font-semibold underline underline-offset-2 hover:text-[#9A3412]"
                >
                  Upgrade
                </Link>{" "}
                to get more monthly credits.
              </p>
            )}
            <Link
              href="/settings/billing"
              className="relative z-10 inline-flex items-center justify-center rounded-xl bg-colly px-4 py-2 text-sm font-medium text-white shadow-brand transition-all duration-250 hover:-translate-y-0.5 hover:bg-colly-hover hover:shadow-brand-hover active:translate-y-0 active:scale-[0.98]"
            >
              Top Up
            </Link>
          </div>
        </section>

        {/* Past Transactions */}
        <section className="surface-card surface-card-interactive relative group p-5">
          {/* Stretched link: the whole card opens the billing history. The
              "View All Transactions" button below is z-10 so it stays clickable. */}
          <Link href="/settings/billing" className="absolute inset-0 z-0">
            <span className="sr-only">View</span>
          </Link>
          <h2 className="font-display text-base text-main">
            Past Transactions
          </h2>
          <div className="mt-4 space-y-2">
            {transactions.length === 0 ? (
              <p className="text-sm text-muted">No transactions yet.</p>
            ) : (
              transactions.map((t) => (
                <TransactionRow
                  key={t.id}
                  amount={Number(t.amount)}
                  date={t.createdAt}
                  status={t.type}
                />
              ))
            )}
          </div>
          <div className="mt-4">
            <Link
              href="/settings/billing"
              className="relative z-10 inline-flex items-center justify-center rounded-xl border border-card-ring bg-card-surface px-4 py-2 text-sm font-medium text-main shadow-sm transition-all duration-250 hover:-translate-y-0.5 hover:border-colly/40 hover:shadow-md active:translate-y-0 active:scale-[0.98]"
            >
              View All Transactions
            </Link>
          </div>
        </section>
      </div>

      {/* Knowledge Base */}
      <section className="surface-card mt-5 p-5">
        <h2 className="font-display text-base text-main">Knowledge Base</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <Link
            href="/products"
            className="surface-panel surface-card-interactive flex items-center justify-between p-4"
          >
            <div>
              <p className="text-sm font-medium text-main">Products</p>
              <p className="text-xs text-muted">
                {productsCount} item{productsCount === 1 ? "" : "s"}
              </p>
            </div>
            <span className="text-sm text-muted">&rarr;</span>
          </Link>
          <Link
            href="/faqs"
            className="surface-panel surface-card-interactive flex items-center justify-between p-4"
          >
            <div>
              <p className="text-sm font-medium text-main">FAQs</p>
              <p className="text-xs text-muted">
                {faqsCount} item{faqsCount === 1 ? "" : "s"}
              </p>
            </div>
            <span className="text-sm text-muted">&rarr;</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
