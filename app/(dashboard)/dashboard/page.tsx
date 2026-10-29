import { connection } from "next/server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { SetupChecklist } from "@/components/dashboard/setup-checklist";

/**
 * Overview route.
 *
 * A Server Component so the activation flags for the setup checklist can be
 * read straight from Prisma. The interactive half of the page (today's sales,
 * pending invoices, channel status, Jiji sync) needs client state and lives in
 * <DashboardOverview />, rendered as this page's child.
 *
 * `connection()` keeps the page out of the prerender, exactly like the
 * dashboard layout next door: `requireAuth()` talks to Supabase Auth and the
 * counts are per-tenant. `export const dynamic = "force-dynamic"` is not an
 * option here (`cacheComponents: true` rejects it).
 */
export default async function OverviewPage() {
  await connection(); // prerendering stops here

  const user = await requireAuth();

  const [business, productCount, messageCount] = await Promise.all([
    prisma.business.findUnique({
      where: { id: user.businessId },
      select: { telegramBotToken: true },
    }),
    prisma.product.count({ where: { businessId: user.businessId } }),
    // Step 3 ("send a test message") is proven by a message that actually came
    // from a customer, so only sender "customer" counts. AI replies cannot
    // exist without one, and this hits the (businessId, sender, createdAt)
    // index the usage queries already use.
    prisma.message.count({
      where: { businessId: user.businessId, sender: "customer" },
    }),
  ]);

  const hasTelegram = Boolean(business?.telegramBotToken);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900 sm:text-2xl">
          Overview
        </h1>
      </div>

      <SetupChecklist
        hasTelegram={hasTelegram}
        hasProducts={productCount > 0}
        hasMessages={messageCount > 0}
      />

      <DashboardOverview />
    </div>
  );
}
