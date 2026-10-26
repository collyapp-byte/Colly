import { prisma } from "@/lib/prisma";
import { downgradeExpiredPlan, ensureFreeGrant } from "@/lib/credits";
import { sendOwnerAlert } from "@/lib/owner-alerts";

/**
 * Scheduled maintenance. Triggered by `.github/workflows/maintenance.yml` (or any
 * scheduler) with `Authorization: Bearer $CRON_SECRET`.
 *
 * Two jobs, both of which used to depend on a human opening the dashboard:
 *
 * 1. Wallet sweep — every business runs through `downgradeExpiredPlan()` and
 *    `ensureFreeGrant()`, so a lapsed paid plan drops to Free and a dormant Free
 *    account still gets its 30-day allowance. Both helpers are compare-and-swap,
 *    so a concurrent renewal or upgrade always wins.
 * 2. Weekly digest — every business whose owner has linked a Telegram chat gets
 *    the last 7 days (AI replies, manual replies, sales count/revenue) as a
 *    message. Sent once a week unless `?digest=force` is passed, so a
 *    five-minute scheduler does not spam owners.
 *
 * Query parameters: `?digest=force|skip` and `?limit=` (businesses per run,
 * default 500, max 2000).
 */

const DEFAULT_BATCH = 500;
const MAX_BATCH = 2000;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

function readBatch(searchParams: URLSearchParams): number {
  const raw = Number(searchParams.get("limit"));
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_BATCH;
  return Math.min(Math.floor(raw), MAX_BATCH);
}

/** True on Mondays, so the digest lands once a week even on a 5-minute cron. */
function isDigestDay(now: Date): boolean {
  return now.getUTCDay() === 1;
}

async function sweepWallets(limit: number) {
  const businesses = await prisma.business.findMany({
    take: limit,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      plan: true,
      planStatus: true,
      planExpiresAt: true,
      planCredits: true,
      topUpCredits: true,
      lastFreeGrantAt: true,
      subscriptionStatus: true,
      gracePeriodEndsAt: true,
    },
  });

  let downgraded = 0;
  let regranted = 0;

  for (const business of businesses) {
    const planBefore = business.plan;

    // Order matters: expiry first, so a lapsed plan is demoted before the Free
    // re-grant is evaluated against the (now) Free row.
    await downgradeExpiredPlan(business);
    if (business.plan !== planBefore) downgraded += 1;

    const creditsAfterDowngrade = business.planCredits;
    await ensureFreeGrant(business);
    if (business.planCredits > creditsAfterDowngrade) regranted += 1;
  }

  return { scanned: businesses.length, downgraded, regranted };
}

async function sendWeeklyDigests(limit: number) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const businesses = await prisma.business.findMany({
    where: { ownerTelegramChatId: { not: null } },
    take: limit,
    select: { id: true, name: true },
  });

  let sent = 0;

  for (const business of businesses) {
    try {
      const [aiReplies, manualReplies, customerMessages, sales] =
        await Promise.all([
          prisma.message.count({
            where: {
              businessId: business.id,
              sender: "ai",
              createdAt: { gte: since },
            },
          }),
          prisma.message.count({
            where: {
              businessId: business.id,
              sender: "agent",
              createdAt: { gte: since },
            },
          }),
          prisma.message.count({
            where: {
              businessId: business.id,
              sender: "customer",
              createdAt: { gte: since },
            },
          }),
          prisma.sale.aggregate({
            where: { businessId: business.id, createdAt: { gte: since } },
            _sum: { totalAmount: true },
            _count: true,
          }),
        ]);

      if (aiReplies + manualReplies + customerMessages === 0) continue;

      const revenue = Number(sales._sum.totalAmount ?? 0);
      const message = [
        `Weekly report for ${business.name}`,
        `AI replies: ${aiReplies}`,
        `Manual replies: ${manualReplies}`,
        `Customer messages: ${customerMessages}`,
        `Sales recorded: ${sales._count} (₦${revenue.toLocaleString("en-NG")})`,
        "",
        "Open your dashboard for the details.",
      ].join("\n");

      await sendOwnerAlert(business.id, message);
      sent += 1;
    } catch (error) {
      console.error(
        `[cron/maintenance] digest failed for business ${business.id}`,
        error,
      );
    }
  }

  return { considered: businesses.length, sent };
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = readBatch(searchParams);
  const digestMode = searchParams.get("digest");

  try {
    const wallets = await sweepWallets(limit);

    const runDigest =
      digestMode === "force" ||
      (digestMode !== "skip" && isDigestDay(new Date()));
    const digest = runDigest
      ? await sendWeeklyDigests(limit)
      : { considered: 0, sent: 0 };

    return Response.json({
      ok: true,
      wallets,
      digest,
      ranAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[GET /api/cron/maintenance]", error);
    return Response.json(
      {
        error: "Maintenance run failed",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
