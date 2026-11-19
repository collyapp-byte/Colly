export const instant = false;
import { connection } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Footer } from "@/components/ui/footer";

/*
 * Chrome for every dashboard route.
 *
 * `cacheComponents` keeps this layout out of the prerender (`await connection()`
 * plus `instant = false`), so the tenant read below runs once per full load and
 * hands the shell its first paint. The rail's account menu, the setup banner and
 * the bell badge used to wait for a `/api/business` round trip after hydration;
 * they are now server props.
 *
 * The flags mirror what `GET /api/business` derives for `pendingTasks`: a
 * channel exists when a bot token is stored, owner alerts when the owner's
 * Telegram chat is linked, and the catalogue dots come from row counts.
 * `lastNotificationsReadAt` is what makes the bell "unread" -- the Notifications
 * page stamps it when opened (see the schema comment on the column).
 */

interface LayoutProps {
  children: React.ReactNode;
}

export default async function DashboardLayout({ children }: LayoutProps) {
  await connection();

  const user = await requireAuth();

  // Everything the shell needs from the tenant row, with the two catalogue
  // counts in the same round trip.
  const business = await prisma.business.findUnique({
    where: { id: user.businessId },
    select: {
      telegramBotToken: true,
      discordBotToken: true,
      ownerTelegramChatId: true,
      lastNotificationsReadAt: true,
      _count: { select: { products: true, faqs: true } },
    },
  });

  // An escalation stays pending until the conversation is handled (the sidebar
  // dot), while the bell only counts the ones raised since the owner last
  // opened Notifications. `CLOSED` is a legacy seed value; excluding it matches
  // the Notifications page's own query.
  const pendingEscalationWhere = {
    businessId: user.businessId,
    escalatedAt: { not: null },
    status: { not: "CLOSED" as const },
  };

  const [pendingEscalations, unreadEscalations] = await Promise.all([
    prisma.conversation.count({ where: pendingEscalationWhere }),
    prisma.conversation.count({
      where: business?.lastNotificationsReadAt
        ? {
            ...pendingEscalationWhere,
            escalatedAt: { gt: business.lastNotificationsReadAt },
          }
        : pendingEscalationWhere,
    }),
  ]);

  const ownerEmail = user.email;
  const emailPrefix = ownerEmail.split("@")[0] || ownerEmail;
  const ownerName =
    user.name?.trim() ||
    emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);

  const telegramConnected = Boolean(business?.telegramBotToken);
  const discordConnected = Boolean(business?.discordBotToken);
  const ownerAlertsLinked = Boolean(business?.ownerTelegramChatId);

  return (
    <DashboardShell
      businessName={user.businessName}
      ownerName={ownerName}
      ownerEmail={ownerEmail}
      isOwner={user.role === "OWNER"}
      hasNoProducts={(business?._count.products ?? 0) === 0}
      hasNoFaqs={(business?._count.faqs ?? 0) === 0}
      hasNoChannels={!telegramConnected && !discordConnected}
      telegramConnected={telegramConnected}
      ownerAlertsLinked={ownerAlertsLinked}
      hasUnreadEscalations={pendingEscalations > 0}
      pendingEscalations={unreadEscalations}
    >
      {children}
      <Footer />
    </DashboardShell>
  );
}

