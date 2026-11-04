import { connection } from "next/server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { STAFF_DENIED_PARAM, STAFF_DENIED_VALUE } from "@/lib/team";
import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { SetupChecklist } from "@/components/dashboard/setup-checklist";
import { StaffDeniedToast } from "@/components/dashboard/staff-denied-toast";

/**
 * Overview route.
 *
 * A Server Component so the activation flags for the setup checklist can be
 * read straight from Prisma. The interactive half of the page (today's sales,
 * pending invoices) needs client state and lives in <DashboardOverview />,
 * rendered as this page's child.
 *
 * The overview's alert banners are seeded from this same read instead of
 * waiting for `/api/business` after hydration. Rendering them in the first
 * paint is what removes the page's largest layout shift: a banner appearing
 * above the stat grid pushed every card on the page down.
 *
 * `connection()` keeps the page out of the prerender, exactly like the
 * dashboard layout next door: `requireAuth()` talks to Supabase Auth and the
 * counts are per-tenant. `export const dynamic = "force-dynamic"` is not an
 * option here (`cacheComponents: true` rejects it).
 *
 * `searchParams` is only read for the Team Collaboration bounce: the proxy
 * sends an invited STAFF account here as `/dashboard?denied=staff_restricted`
 * and this page raises the "owner only" toast.
 */
export default async function OverviewPage({
  searchParams,
}: PageProps<"/dashboard">) {
  await connection(); // prerendering stops here

  const user = await requireAuth();
  const denied =
    (await searchParams)[STAFF_DENIED_PARAM] === STAFF_DENIED_VALUE;

  const [business, productCount] = await Promise.all([
    prisma.business.findUnique({
      where: { id: user.businessId },
      // Everything the overview needs for its first paint: the checklist's
      // Telegram step and the three alert banners.
      select: {
        telegramBotToken: true,
        discordBotToken: true,
        paymentInstructions: true,
        planStatus: true,
        paymentFailedAt: true,
      },
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

  
    const hasAiReply = (await prisma.message.count({
    where: { businessId: user.businessId, sender: "ai" }
  })) > 0;


      const hasFaqs = (await prisma.faq.count({
    where: { businessId: user.businessId }
  })) > 0;



    return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      {denied && <StaffDeniedToast />}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Hello {user.name ? user.name.split(" ")[0] : "there"} 👋
          </h1>
          <p className="text-sm text-gray-500 mt-1">Here is what is happening with your business today.</p>
        </div>
      </div>

      <SetupChecklist 
        hasProducts={productCount > 0} hasFaqs={hasFaqs} hasAiReply={hasAiReply} 
      />

      <DashboardOverview
        status={{
          paymentInstructions: business?.paymentInstructions ?? null,
          isConnected: Boolean(
            business?.telegramBotToken || business?.discordBotToken,
          ),
          planStatus: business?.planStatus ?? null,
          paymentFailedAt: business?.paymentFailedAt
            ? business.paymentFailedAt.toISOString()
            : null,
        }}
      />
    </div>
  );
}
