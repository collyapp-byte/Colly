import type { Metadata } from "next";
import { connection } from "next/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { CollyAiWidget } from "@/components/dashboard/colly-ai-widget";
import { SplashScreen } from "@/components/ui/splash-screen";
import { Footer } from "@/components/ui/footer";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { requireSiteAccess } from "@/lib/auth-guards";

/*
 * Do NOT add `export const dynamic = "force-dynamic"` here. `next.config.ts`
 * turns on `cacheComponents`, and Next 16 rejects that combination with
 * "Route segment config \"dynamic\" is not compatible with
 * `nextConfig.cacheComponents`. Please remove it." -- which fails to compile
 * this module and answers 500 for every route in the app, not just this group.
 *
 * `connection()` is what keeps this layout out of the prerender. `requireAuth()`
 * talks to Supabase Auth, whose client stamps token expiry with `Date.now()`,
 * and a prerender cannot use a value that changes between renders -- without the
 * call below, every route in this group reports "Next.js encountered the
 * unstable value `Date.now()` while prerendering" from here.
 *
 * The auth check runs at the layout level, NOT inside a Suspense boundary, so
 * that `requireAuth()`'s `redirect()` is not swallowed while streaming. An agent
 * session must be sent to /agents/dashboard, not shown a half-empty shell.
 */

/*
 * `instant = false` opts this segment out of the static-shell / instant-nav
 * validation that Cache Components runs, because the auth check below blocks on
 * purpose: the layout must resolve the session before rendering so an agent
 * session can be redirected to /agents/dashboard instead of streaming a shell.
 * Without this, `next build` fails with "Route "/": Next.js encountered uncached
 * or runtime data during prerendering".
 */
export const instant = false;

export const metadata: Metadata = {
  title: {
    default: "Dashboard",
    template: "%s · Colly",
  },
  // The signed-in app is never useful to a crawler — every route in this group
  // redirects to /login without a session — so the whole tree is noindex.
  robots: { index: false, follow: false },
};

export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  await connection(); // prerendering stops here

  const user = await requireAuth();
  await requireSiteAccess(user.businessId);

  const business = await prisma.business.findUnique({
    where: { id: user.businessId },
    select: {
      telegramBotToken: true,
      ownerTelegramChatId: true,
      discordBotToken: true,
      lastNotificationsReadAt: true,
      _count: { select: { products: true, faqs: true } },
    },
  });

  // Unread escalations only: anything escalated after the owner last opened
  // the Notifications page.
  const unreadCount = await prisma.conversation.count({
    where: {
      businessId: user.businessId,
      status: "ESCALATED",
      escalatedAt: {
        gt: business?.lastNotificationsReadAt ?? new Date(0),
      },
    },
  });

  return (
    <>
      {/* Brand splash on sign-in. Scoped to this layout, not the root one: it is
          a full-viewport overlay, and on public pages it would sit on top of the
          hero (the LCP element) for 500 ms + a 200 ms fade. */}
      <SplashScreen />
      <DashboardShell
        businessName={user.businessName}
        hasNoProducts={(business?._count.products ?? 0) === 0}
        hasNoFaqs={(business?._count.faqs ?? 0) === 0}
        hasPendingEscalations={unreadCount > 0}
        pendingEscalations={unreadCount}
        telegramConnected={Boolean(business?.telegramBotToken)}
        ownerAlertsLinked={Boolean(business?.ownerTelegramChatId)}
        hasNoChannels={!business?.telegramBotToken && !business?.discordBotToken}
      >
        {children}
        <Footer />
      </DashboardShell>
      <CollyAiWidget ownerName={user.name} />
    </>
  );
}
