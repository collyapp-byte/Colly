import Link from "next/link";
import { connection } from "next/server";
import { BellRing, MessageSquare } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { BackButton } from "@/components/ui/back-button";
import { RefreshOnMount } from "@/components/dashboard/refresh-on-mount";

export const metadata = { title: "Notifications" };

/**
 * Pending escalations: conversations the AI flagged for a human. The
 * `escalatedAt` flag is written even when the owner's Telegram is not linked,
 * so these stay visible here until the conversation is handled or closed.
 */
export default async function NotificationsPage() {
  await connection();

  const user = await requireAuth();

  // Opening the page clears the unread bell badge.
  await prisma.business.update({
    where: { id: user.businessId },
    data: { lastNotificationsReadAt: new Date() },
  });

  const rows = await prisma.conversation.findMany({
    where: {
      businessId: user.businessId,
      escalatedAt: { not: null },
      status: { not: "CLOSED" },
    },
    orderBy: { escalatedAt: "desc" },
    include: {
      customer: { select: { name: true, phone: true } },
      messages: {
        where: { sender: "customer" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  return (
    <div className="mx-auto w-full max-w-3xl">
      <RefreshOnMount />
      <BackButton />
      <h1 className="font-display text-2xl text-gray-900 sm:text-3xl">
        Notifications
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Customers waiting for a human reply from your team.
      </p>

      {rows.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-gray-200 bg-surface p-10 text-center">
          <BellRing
            className="mx-auto h-6 w-6 text-gray-400"
            aria-hidden
          />
          <p className="mt-3 text-sm text-gray-500">
            You are all caught up. New escalations will appear here.
          </p>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((row) => {
            const lastMessage = row.messages[0] ?? null;
            return (
              <li
                key={row.id}
                className="rounded-lg border border-gray-200 bg-surface p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display font-semibold text-gray-900">
                      {row.customer.name || row.customer.phone}
                    </p>
                    {row.customer.name && (
                      <p className="text-xs text-gray-500">{row.customer.phone}</p>
                    )}
                    <p className="mt-2 flex items-start gap-2 text-sm text-gray-700">
                      <MessageSquare
                        className="mt-0.5 h-4 w-4 shrink-0 text-gray-400"
                        aria-hidden
                      />
                      <span>
                        {lastMessage?.content ??
                          "This customer needs your attention."}
                      </span>
                    </p>
                    {row.escalatedAt && (
                      <p className="mt-2 text-xs text-gray-400">
                        Escalated{" "}
                        {new Date(row.escalatedAt).toLocaleString("en-NG", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/conversations/${row.id}`}
                    className="shrink-0 rounded-lg bg-colly px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-colly-hover"
                  >
                    Go to Conversation
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
