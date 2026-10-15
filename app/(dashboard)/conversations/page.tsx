"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { StatusBadge } from "@/components/conversations/status-badge";
import { AiPausedBanner } from "@/components/dashboard/ai-paused-banner";
import { formatRelativeTime } from "@/lib/format";

type ConversationListItem = {
  id: string;
  status: string;
  createdAt: string;
  customer: { id: string; name: string; phone: string };
  lastMessage: { content: string; sender: string; createdAt: string } | null;
};

type Usage = {
  plan: string;
  planStatus: string;
  planInterval: string;
  aiRepliesUsed: number;
  aiRepliesLimit: number;
  creditsBalance: number;
};

const EMPTY_STATE_TEXT =
  "No conversations yet. When customers message your WhatsApp, they'll appear here.";

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<
    ConversationListItem[] | null
  >(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadError, setHasLoadError] = useState(false);
  const [dismissedBanner, setDismissedBanner] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [convsRes, usageRes] = await Promise.all([
          fetch("/api/conversations"),
          fetch("/api/billing/usage"),
        ]);

        if (!convsRes.ok) {
          throw new Error(`Request failed with status ${convsRes.status}`);
        }

        try {
          const convsData: { conversations: ConversationListItem[] } =
            await convsRes.json();
          if (!Array.isArray(convsData?.conversations)) {
            throw new Error("Unexpected conversations response");
          }
          if (active) setConversations(convsData.conversations);
        } catch (parseError) {
          console.error("[conversations] parse failed:", parseError);
          if (active) setHasLoadError(true);
        }

        if (usageRes.ok) {
          try {
            const usageData = await usageRes.json();
            if (active) setUsage(usageData);
          } catch (usageError) {
            // Usage is non-critical; keep the conversation list usable without it.
            console.error("[conversations] usage parse failed:", usageError);
          }
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Something went wrong");
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  const loading = conversations === null && error === null && !hasLoadError;

  const showBanner =
    !dismissedBanner &&
    usage &&
    (usage.planStatus !== "active" ||
      usage.aiRepliesUsed >= usage.aiRepliesLimit) &&
    usage.creditsBalance === 0;

  const bannerReason = usage
    ? usage.planStatus !== "active"
      ? "plan_expired"
      : usage.creditsBalance === 0
      ? "cap_hit"
      : null
    : null;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl text-gray-900 sm:text-3xl">
          Conversations
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Every chat your assistant has handled. Jump in anytime.
        </p>
      </div>

      {showBanner && bannerReason && (
        <AiPausedBanner
          reason={bannerReason}
          used={usage.aiRepliesUsed}
          cap={usage.aiRepliesLimit}
          onDismiss={() => setDismissedBanner(true)}
        />
      )}

      {hasLoadError && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/5 p-4 text-sm text-warning">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            Some conversations couldn&apos;t be loaded. Refresh to try again.
          </p>
        </div>
      )}

      {loading && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-surface">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-start gap-3 border-b border-gray-100 px-4 py-4 last:border-b-0 sm:px-6"
            >
              <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-gray-100" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-3.5 w-32 animate-pulse rounded bg-gray-100" />
                <div className="h-3 w-full max-w-sm animate-pulse rounded bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">Could not load conversations</p>
            <p className="text-danger/80">{error}</p>
          </div>
        </div>
      )}

      {conversations && conversations.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-200 bg-surface p-10 text-center">
          <p className="mx-auto max-w-md text-sm text-gray-500">
            {EMPTY_STATE_TEXT}
          </p>
        </div>
      )}

      {conversations && conversations.length > 0 && (
        <ul className="overflow-hidden rounded-lg border border-gray-200 bg-surface">
          {conversations.map((conversation) => (
            <li
              key={conversation.id}
              className="border-b border-gray-100 last:border-b-0"
            >
              <Link
                href={`/conversations/${conversation.id}`}
                className="flex items-start gap-3 px-4 py-4 transition-colors hover:bg-gray-50 sm:px-6"
              >
                <span
                  aria-hidden
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-600"
                >
                  {initials(conversation.customer.name)}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate font-semibold text-gray-900">
                      {conversation.customer.name}
                    </p>
                    <span className="shrink-0 text-xs text-gray-400">
                      {formatRelativeTime(
                        conversation.lastMessage?.createdAt ??
                          conversation.createdAt,
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {conversation.customer.phone}
                  </p>
                  <p className="mt-1 truncate text-sm text-gray-500">
                    {conversation.lastMessage?.content ?? "No messages yet"}
                  </p>
                </div>

                <div className="pt-0.5">
                  <StatusBadge status={conversation.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
