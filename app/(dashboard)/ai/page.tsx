import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { getPlanLimits } from "@/lib/plans";
import { TransactionRow } from "@/components/dashboard/transaction-row";
import Link from "next/link";
import { MessageSquare } from "lucide-react";

export default async function CollyAIPage() {
  // Keep this page dynamic: it renders per-owner data (plan, usage, wallet,
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
      creditWalletBalanceNaira: true,
      messagesUsedThisMonth: true,
      manualMessagesUsedThisMonth: true,
      plan: true,
      planInterval: true,
      channel: true,
    },
  });

  const [productsCount, faqsCount, transactions] = await Promise.all([
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
  ]);

  // Plan limits from the same source of truth the billing API uses
  // (lib/plans.ts). Free plan = 0 included messages; paid tiers carry their
  // real allowance (e.g. Telegram Green = 2000).
  const limits = getPlanLimits(
    business?.plan ?? "free",
    business?.planInterval ?? "monthly",
    business?.channel ?? null,
  );
  const includedMsgs = limits.includedMsgs;
  const includedManual = limits.includedManualMessages;
  const aiUsed = business?.messagesUsedThisMonth ?? 0;
  const manualUsed = business?.manualMessagesUsedThisMonth ?? 0;
  const isFreePlan = includedMsgs === 0 && includedManual === 0;
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
          <span className="inline-flex items-center rounded-full border border-green-200 bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
            Active
          </span>
          {ownerAlertsActive && (
            <span className="inline-flex items-center rounded-full border border-green-200 bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 p-3">
              <div>
                <p className="text-sm font-medium text-gray-900">Telegram</p>
                <p className="text-xs text-gray-500">Customer-facing bot</p>
              </div>
              <div className="flex items-center gap-2">
                {telegramConnected ? (
                  <span className="inline-flex items-center rounded-full border border-green-200 bg-green-100 px-2.5 py-0.5 text-[11px] font-medium text-green-700">
                    Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-600">
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
                  <span className="inline-flex items-center rounded-full border border-green-200 bg-green-100 px-2.5 py-0.5 text-[11px] font-medium text-green-700">
                    Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-gray-600">
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
                <span className="inline-flex items-center rounded-full border border-green-200 bg-green-100 px-2.5 py-0.5 text-[11px] font-medium text-green-700">
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

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Credits & Usage */}
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="font-display text-base text-gray-900">
            Credits & Usage
          </h2>
          <div className="mt-4 space-y-4">
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">AI Replies</span>
                <span className="font-medium text-gray-900">
                  {includedMsgs === 0 ? "0 / 0" : `${aiUsed} / ${includedMsgs}`}
                </span>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-gray-100">
                <div
                  className="h-2 rounded-full bg-[#FF6600]"
                  style={{
                    width:
                      includedMsgs === 0
                        ? "0%"
                        : `${Math.min(100, (aiUsed / includedMsgs) * 100)}%`,
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Manual Replies</span>
                <span className="font-medium text-gray-900">
                  {includedManual === 0
                    ? "0 / 0"
                    : `${manualUsed} / ${includedManual}`}
                </span>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-gray-100">
                <div
                  className="h-2 rounded-full bg-[#FF6600]"
                  style={{
                    width:
                      includedManual === 0
                        ? "0%"
                        : `${Math.min(100, (manualUsed / includedManual) * 100)}%`,
                  }}
                />
              </div>
            </div>
            {isFreePlan && (
              <p className="rounded-lg border border-[#FF6600]/30 bg-[#FFF4EC] px-3 py-2 text-sm text-[#C2410C]">
                You are on the Free plan.{" "}
                <Link
                  href="/settings/billing/plans"
                  className="font-semibold underline underline-offset-2 hover:text-[#9A3412]"
                >
                  Upgrade
                </Link>{" "}
                to get included messages.
              </p>
            )}
            <div className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
              <span className="text-sm text-gray-600">Wallet Balance</span>
              <span className="font-semibold text-gray-900">
                ₦{(business?.creditWalletBalanceNaira ?? 0).toLocaleString("en-NG")} remaining
              </span>
            </div>
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
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
