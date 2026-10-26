import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import {
  LOW_CREDIT_MESSAGE,
  getAiReplyCreditCost,
  getPlanLimits,
  totalAvailableCredits,
} from "@/lib/plans";
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
      tone: true,
      ownerTelegramChatId: true,
      telegramBotToken: true,
      discordBotToken: true,
      planCredits: true,
      topUpCredits: true,
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
  // The Free tier includes 50 credits every month, so "Free" is decided by the
  // plan name rather than by a zero credit grant.
  const isFreePlan = (business?.plan ?? "free") === "free";
  const tone = business?.tone === "formal" ? "Formal" : "Friendly";
  const ownerAlertsActive = Boolean(business?.ownerTelegramChatId);
  const telegramConnected = Boolean(business?.telegramBotToken);
  const discordConnected = Boolean(business?.discordBotToken);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-gray-900">Colly AI</h1>
          <p className="mt-1 text-sm text-gray-500">
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
          className="mb-6 flex items-start gap-3 rounded-xl border border-[#FF6600]/40 bg-[#FFF4EC] p-4 transition-colors hover:bg-[#FFEADB]"
        >
          <span className="mt-0.5 text-lg" aria-hidden>
            ⚠️
          </span>
          <span>
            <span className="block font-semibold text-[#C2410C]">
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
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="font-display text-base text-gray-900">AI Persona</h2>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700">
              Tone: {tone}
            </span>
            <span className="inline-flex items-center rounded-full border border-[#FF6600]/20 bg-[#FFF4EC] px-3 py-1 text-xs font-medium text-[#FF6600]">
              Adaptive Language: Auto-detects English & Pidgin
            </span>
          </div>
          <div className="mt-4">
            <Link
              href="/settings"
              className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Edit Tone
            </Link>
          </div>
        </section>

        {/* Connected Apps */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="font-display text-base text-gray-900">
            Connected Apps
          </h2>
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 p-3">
              <div>
                <p className="text-sm font-medium text-gray-900">Telegram</p>
                <p className="text-xs text-gray-500">Customer-facing bot</p>
              </div>
              <div className="flex items-center gap-2">
                {telegramConnected ? (
                  <span className="inline-flex items-center rounded-full border border-green-200 bg-green-100 px-2.5 py-0.5 text-[11px] font-medium text-green-700 whitespace-nowrap">
                    Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-600 whitespace-nowrap">
                    Disconnected
                  </span>
                )}
                <Link
                  href="/settings/ai-line"
                  className="inline-flex items-center rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Manage
                </Link>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 p-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-medium text-gray-900">
                  <MessageSquare
                    className="h-4 w-4 shrink-0 text-gray-500"
                    aria-hidden
                  />
                  Discord
                </p>
                <p className="text-xs text-gray-500">Customer-facing bot</p>
              </div>
              <div className="flex items-center gap-2">
                {discordConnected ? (
                  <span className="inline-flex items-center rounded-full border border-green-200 bg-green-100 px-2.5 py-0.5 text-[11px] font-medium text-green-700 whitespace-nowrap">
                    Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-600 whitespace-nowrap">
                    Disconnected
                  </span>
                )}
                <Link
                  href="/settings/ai-line"
                  className="inline-flex items-center rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  {discordConnected ? "Manage" : "Connect Discord"}
                </Link>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 p-3">
              <div>
                <p className="text-sm font-medium text-gray-900">Web Chat</p>
                <p className="text-xs text-gray-500">
                  AI replies to website visitors.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-green-200 bg-green-100 px-2.5 py-0.5 text-[11px] font-medium text-green-700 whitespace-nowrap">
                  Active
                </span>
                <Link
                  href="/settings/web-chat"
                  className="inline-flex items-center rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
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
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="font-display text-base text-gray-900">
            Credits & Usage
          </h2>
          <div className="mt-4 space-y-4">
            <div className="rounded-lg border border-gray-100 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Credit balance</span>
                <span className="font-semibold text-gray-900">
                  {creditBalance.toLocaleString()} credits
                </span>
              </div>
              {/* Split wallet: the two buckets that make up the total. */}
              <div className="mt-2 space-y-1 border-t border-gray-100 pt-2 text-xs text-gray-500">
                <div className="flex items-center justify-between">
                  <span>Plan credits (monthly)</span>
                  <span className="font-medium text-gray-700">
                    {planCredits.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Top-up credits (never expire)</span>
                  <span className="font-medium text-gray-700">
                    {topUpCredits.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              {limits.credits > 0
                ? `${limits.credits.toLocaleString()} credits are included with your plan each billing month.`
                : "Your plan does not add credits — top up to keep the AI replying."}{" "}
              1 credit = ₦1. An AI reply costs {aiReplyCost} credits on this
              channel; manual replies are free.
            </p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">AI replies this month</span>
              <span className="font-medium text-gray-900">
                {aiUsed.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Manual replies this month</span>
              <span className="font-medium text-gray-900">
                {manualUsed.toLocaleString()}
              </span>
            </div>
            {creditBalance < aiReplyCost && (
              <p className="rounded-lg border border-[#FF6600]/30 bg-[#FFF4EC] px-3 py-2 text-sm text-[#C2410C]">
                {LOW_CREDIT_MESSAGE}
              </p>
            )}
            {isFreePlan && (
              <p className="rounded-lg border border-[#FF6600]/30 bg-[#FFF4EC] px-3 py-2 text-sm text-[#C2410C]">
                You are on the Free plan.{" "}
                <Link
                  href="/settings/billing/plans"
                  className="font-semibold underline underline-offset-2 hover:text-[#9A3412]"
                >
                  Upgrade
                </Link>{" "}
                to get more monthly credits.
              </p>
            )}
            <Link
              href="/settings/billing"
              className="inline-flex items-center justify-center rounded-lg bg-[#FF6600] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#E65C00]"
            >
              Top Up
            </Link>
          </div>
        </section>

        {/* Past Transactions */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="font-display text-base text-gray-900">
            Past Transactions
          </h2>
          <div className="mt-4 space-y-2">
            {transactions.length === 0 ? (
              <p className="text-sm text-gray-500">No transactions yet.</p>
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
              className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              View All Transactions
            </Link>
          </div>
        </section>
      </div>

      {/* Knowledge Base */}
      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="font-display text-base text-gray-900">Knowledge Base</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <Link
            href="/products"
            className="flex items-center justify-between rounded-lg border border-gray-100 p-4 transition-colors hover:bg-gray-50"
          >
            <div>
              <p className="text-sm font-medium text-gray-900">Products</p>
              <p className="text-xs text-gray-500">
                {productsCount} item{productsCount === 1 ? "" : "s"}
              </p>
            </div>
            <span className="text-sm text-gray-500">&rarr;</span>
          </Link>
          <Link
            href="/faqs"
            className="flex items-center justify-between rounded-lg border border-gray-100 p-4 transition-colors hover:bg-gray-50"
          >
            <div>
              <p className="text-sm font-medium text-gray-900">FAQs</p>
              <p className="text-xs text-gray-500">
                {faqsCount} item{faqsCount === 1 ? "" : "s"}
              </p>
            </div>
            <span className="text-sm text-gray-500">&rarr;</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
