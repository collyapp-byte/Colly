import { connection } from "next/server";
import Link from "next/link";
import { Plus, ShoppingCart } from "lucide-react";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { STAFF_DENIED_PARAM, STAFF_DENIED_VALUE } from "@/lib/team";
import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { SetupChecklist } from "@/components/dashboard/setup-checklist";
import { StaffDeniedToast } from "@/components/dashboard/staff-denied-toast";

/**
 * Dashboard route.
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
export default async function DashboardPage({
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
        lastNotificationsReadAt: true,
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

  // Unread notifications: escalations raised since the owner last opened
  // Notifications. `lastNotificationsReadAt` is stamped by the Notifications
  // page (and the "Mark all as done" button), so this is the source of truth
  // for the home banner and the header bell.
  const unreadWhere = {
    businessId: user.businessId,
    escalatedAt: { not: null },
    status: { not: "CLOSED" },
    ...(business?.lastNotificationsReadAt
      ? { escalatedAt: { gt: business.lastNotificationsReadAt } }
      : {}),
  };

  const [unreadCount, latestEscalation] = await Promise.all([
    prisma.conversation.count({ where: unreadWhere }),
    prisma.conversation.findFirst({
      where: unreadWhere,
      orderBy: { escalatedAt: "desc" },
      include: {
        customer: { select: { name: true, phone: true } },
        messages: {
          where: { sender: "customer" },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    }),
  ]);

  const hasAiReply =
    (await prisma.message.count({
      where: { businessId: user.businessId, sender: "ai" },
    })) > 0;

  const hasFaqs =
    (await prisma.faq.count({
      where: { businessId: user.businessId },
    })) > 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 md:space-y-6">
      {denied && <StaffDeniedToast />}

      {/* Home notification banner: the single most recent unread escalation.
           Stacks nothing; a +N pill (capped at +9) appears before the arrow
           when there is more than one unread item. The whole bar links to
           /notifications, which clears the unread state on load. */}
      {unreadCount > 0 && latestEscalation && (
        <Link
          href="/notifications"
          className="surface-card flex items-center justify-between gap-3 px-3 py-2 text-sm border-l-4 border-l-colly"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-main truncate">
              {latestEscalation.customer.name ||
                latestEscalation.customer.phone}
            </p>
            <p className="text-xs text-muted truncate">
              {latestEscalation.messages[0]?.content ??
                "This customer needs your attention."}
            </p>
          </div>
          {unreadCount > 1 && (
            <span
              className="shrink-0 inline-flex items-center rounded-full bg-colly/10 px-2 py-0.5 text-[10px] font-semibold text-colly"
            >
              +{Math.min(unreadCount - 1, 9)}
            </span>
          )}
          <span className="shrink-0 text-muted">→</span>
        </Link>
      )}

      {/* Greeting + the two actions an owner reaches for most. The card gives
          the page a clear top edge instead of the bare heading floating in the
          dashboard's own surface. */}
      <header className="surface-card flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center md:p-6">
        <div className="min-w-0">
          {/* The rail row for this page is "Dashboard"; the eyebrow matches it
              and renders as DASHBOARD through `uppercase`. */}
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-colly">
            Dashboard
          </p>
          <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-main sm:text-3xl">
            Hello {user.name ? user.name.split(" ")[0] : "there"} 👋
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-muted">
            Here is what is happening with your business today.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/products"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-card-ring bg-card-surface px-4 py-2 text-sm font-semibold text-main shadow-sm transition-all duration-250 hover:-translate-y-0.5 hover:border-colly/40 hover:shadow-md active:translate-y-0 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add product
          </Link>
          <Link
            href="/sales"
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-colly px-4 py-2 text-sm font-semibold text-white shadow-brand transition-all duration-250 hover:-translate-y-0.5 hover:bg-colly-hover hover:shadow-brand-hover active:translate-y-0 active:scale-[0.98]"
          >
            <ShoppingCart className="h-4 w-4" aria-hidden />
            Record a sale
          </Link>
        </div>
      </header>

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
