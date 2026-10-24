"use client";

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent,
} from "react";
import Link from "next/link";
import { CircleAlert } from "lucide-react";
import { toast } from "sonner";
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
  creditWalletBalanceNaira: number;
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
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    usage.creditWalletBalanceNaira === 0;

  const bannerReason = usage
    ? usage.planStatus !== "active"
      ? "plan_expired"
      : usage.creditWalletBalanceNaira === 0
      ? "cap_hit"
      : null
    : null;

  async function handleDelete(id: string) {
    if (
      !window.confirm(
        "Delete this conversation? This cannot be undone.",
      )
    ) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to delete conversation");
      }
      setConversations((prev) =>
        prev ? prev.filter((conversation) => conversation.id !== id) : prev,
      );
      toast.success("Conversation deleted");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not delete conversation",
      );
    } finally {
      setDeletingId(null);
    }
  }

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
            <SwipeableRow
              key={conversation.id}
              conversation={conversation}
              deleting={deletingId === conversation.id}
              onDelete={handleDelete}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

const SWIPE_WIDTH = 88;

function SwipeableRow({
  conversation,
  deleting,
  onDelete,
}: {
  conversation: ConversationListItem;
  deleting: boolean;
  onDelete: (id: string) => void;
}) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const offsetRef = useRef(0);
  const startX = useRef<number | null>(null);
  const startOffset = useRef(0);
  const moved = useRef(false);

  function setRowOffset(next: number) {
    offsetRef.current = next;
    setOffset(next);
  }

  function handleTouchStart(event: TouchEvent<HTMLAnchorElement>) {
    startX.current = event.touches[0].clientX;
    startOffset.current = offsetRef.current;
    moved.current = false;
    setDragging(true);
  }

  function handleTouchMove(event: TouchEvent<HTMLAnchorElement>) {
    if (startX.current === null) return;
    const delta = event.touches[0].clientX - startX.current;
    if (Math.abs(delta) > 8) moved.current = true;
    const next = Math.max(
      -SWIPE_WIDTH,
      Math.min(0, startOffset.current + delta),
    );
    setRowOffset(next);
  }

  function handleTouchEnd() {
    if (startX.current === null) return;
    startX.current = null;
    setDragging(false);
    setRowOffset(offsetRef.current < -SWIPE_WIDTH / 2 ? -SWIPE_WIDTH : 0);
  }

  function handleClick(event: ReactMouseEvent<HTMLAnchorElement>) {
    if (moved.current) {
      moved.current = false;
      event.preventDefault();
      return;
    }
    if (offsetRef.current !== 0) {
      event.preventDefault();
      setRowOffset(0);
    }
  }

  return (
    <li className="relative overflow-hidden border-b border-gray-100 last:border-b-0">
      <button
        type="button"
        onClick={() => onDelete(conversation.id)}
        disabled={deleting}
        aria-label={`Delete conversation with ${conversation.customer.name}`}
        className="absolute inset-y-0 right-0 flex w-[88px] items-center justify-center bg-red-600 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60"
      >
        {deleting ? "..." : "Delete"}
      </button>

      <Link
        href={`/conversations/${conversation.id}`}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging ? "none" : "transform 150ms",
        }}
        className="relative z-10 flex touch-pan-y items-start gap-3 bg-surface px-4 py-4 transition-colors hover:bg-gray-50 sm:px-6"
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
  );
}
