"use client";

import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CircleAlert,
  Hand,
  LoaderCircle,
  PauseCircle,
  Send,
} from "lucide-react";
import { ChatBubble } from "@/components/conversations/chat-bubble";
import { StatusBadge } from "@/components/conversations/status-badge";
import { formatClockTime, isInFuture } from "@/lib/format";

// The open conversation is refetched on this interval so agent replies and new
// customer messages appear without a manual reload.
const POLL_INTERVAL_MS = 5000;

// Matches the other dashboard inputs so the agent composer looks native.
const INPUT_CLASS =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-colly focus:ring-2 focus:ring-colly/20";

type Message = {
  id: string;
  sender: string;
  content: string;
  createdAt: string;
};

type Conversation = {
  id: string;
  status: string;
  createdAt: string;
  // null (or a timestamp in the past) means the AI is answering; a future
  // timestamp means an agent has taken over and the AI is paused.
  pausedUntil: string | null;
  customer: { id: string; name: string; phone: string };
};

type PlanState = {
  plan: string;
  aiPaused: boolean;
  includedManualMessages: number;
  manualMessagesRemaining: number;
};

export default function ConversationDetailPage() {
  return (
    <Suspense fallback={<ConversationDetailFallback />}>
      <ConversationDetail />
    </Suspense>
  );
}

/**
 * The conversation id comes from the URL, which isn't known while the route is
 * being prerendered. Reading it therefore has to happen inside the Suspense
 * boundary above — Cache Components rejects URL data read outside one.
 */
function ConversationDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [plan, setPlan] = useState<PlanState | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Action failures (take over / resume / send) show inline, so a bad request
  // never replaces the conversation that is already on screen.
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  // Polling must not fight the "scroll to newest" effect, so only a growing
  // message list scrolls.
  const lastMessageCount = useRef(0);

  useEffect(() => {
    let active = true;

    async function load(initial: boolean) {
      try {
        const res = await fetch(`/api/conversations/${id}`, {
          cache: "no-store",
        });
        if (res.status === 404) {
          throw new Error("This conversation could not be found.");
        }
        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }
        const data: {
          conversation: Conversation;
          messages: Message[];
          plan: PlanState;
        } = await res.json();
        if (active) {
          setConversation(data.conversation);
          setMessages(data.messages);
          setPlan(data.plan);
        }
      } catch (err) {
        // A dropped poll keeps the messages already on screen; only the first
        // load turns into a full-page error.
        if (active && initial) {
          setError(err instanceof Error ? err.message : "Something went wrong");
        }
      }
    }

    load(true);
    const timer = setInterval(() => load(false), POLL_INTERVAL_MS);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [id]);

  const messageCount = messages?.length ?? 0;

  // Keep the newest message in view on first load and whenever one arrives.
  useEffect(() => {
    if (messageCount > lastMessageCount.current) {
      bottomRef.current?.scrollIntoView({ block: "end" });
    }
    lastMessageCount.current = messageCount;
  }, [messageCount]);

  // An expired timestamp means the takeover has lapsed and the AI is active.
  const paused = conversation?.pausedUntil
    ? isInFuture(conversation.pausedUntil)
    : false;

  // The AI is off (free/expired plan or an active takeover); the owner answers
  // by hand. The composer stays open while free manual replies remain.
  const aiPaused = plan?.aiPaused ?? false;
  const manualRemaining = plan?.manualMessagesRemaining ?? 0;
  const canReplyManually = manualRemaining > 0;
  const showComposer = paused || (aiPaused && canReplyManually);

  async function handleTakeOver() {
    setActionError(null);
    setBusy(true);

    try {
      const res = await fetch(`/api/conversations/${id}/takeover`, {
        method: "POST",
      });
      const data = (await res.json()) as {
        pausedUntil?: string | null;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error ?? `Request failed with status ${res.status}`);
      }

      setConversation((prev) =>
        prev ? { ...prev, pausedUntil: data.pausedUntil ?? null } : prev,
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleResumeAi() {
    const aiContext = window.prompt(
      "Optional: Tell the AI what to do for this customer",
    );
    // Cancelling the prompt leaves the human takeover in place.
    if (aiContext === null) return;

    setActionError(null);
    setBusy(true);

    try {
      const res = await fetch(`/api/conversations/${id}/takeover`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiContext: aiContext.trim() }),
      });
      const data = (await res.json()) as {
        pausedUntil?: string | null;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error ?? `Request failed with status ${res.status}`);
      }

      setConversation((prev) => (prev ? { ...prev, pausedUntil: null } : prev));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const content = draft.trim();
    if (!content || sending) return;

    setActionError(null);
    setSending(true);

    try {
      const res = await fetch(`/api/conversations/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = (await res.json()) as { message?: Message; error?: string };

      if (!res.ok || !data.message) {
        throw new Error(data.error ?? `Request failed with status ${res.status}`);
      }

      const created = data.message;
      setMessages((prev) => (prev ? [...prev, created] : [created]));
      setDraft("");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSending(false);
    }
  }

  const loading = conversation === null && messages === null && error === null;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link
        href="/conversations"
        className="mb-4 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to Conversations
      </Link>

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{error}</p>
        </div>
      )}

      {loading && (
        <div className="rounded-lg border border-gray-200 bg-surface p-6">
          <div className="h-5 w-40 animate-pulse rounded bg-gray-100" />
          <div className="mt-6 space-y-4">
            <div className="h-10 w-2/3 animate-pulse rounded-2xl bg-gray-100" />
            <div className="ml-auto h-10 w-1/2 animate-pulse rounded-2xl bg-gray-100" />
            <div className="h-10 w-3/5 animate-pulse rounded-2xl bg-gray-100" />
          </div>
        </div>
      )}

      {conversation && (
        <>
          {/* Header */}
          <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="truncate font-display text-xl text-gray-900">
                  {conversation.customer.name}
                </h1>
                <StatusBadge status={conversation.status} />
              </div>
              <p className="mt-0.5 text-sm text-gray-500">
                {conversation.customer.phone}
              </p>
            </div>

            {conversation.status === "HUMAN_TAKEOVER" ? (
              <button
                type="button"
                onClick={handleResumeAi}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-60"
              >
                {busy ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Hand className="h-4 w-4" aria-hidden />
                )}
                Return to AI
              </button>
            ) : (
              !paused && (
                <button
                  type="button"
                  onClick={handleTakeOver}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-colly px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-colly-hover disabled:opacity-60"
                >
                  {busy ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Hand className="h-4 w-4" aria-hidden />
                  )}
                  Take Over
                </button>
              )
            )}
          </div>

          {actionError && (
            <div className="mt-4 flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p>{actionError}</p>
            </div>
          )}

          {/* Human takeover banner */}
          {paused && conversation.pausedUntil && (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-colly/30 bg-colly-light px-4 py-3 sm:px-6">
              <PauseCircle className="h-5 w-5 shrink-0 text-colly" aria-hidden />
              <p className="min-w-0 flex-1 text-sm text-gray-900">
                AI paused until{" "}
                <span className="font-semibold">
                  {formatClockTime(conversation.pausedUntil)}
                </span>
                . You are replying manually.
              </p>
              {conversation.status !== "HUMAN_TAKEOVER" && (
                <button
                  type="button"
                  onClick={handleResumeAi}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-colly px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-colly-hover disabled:opacity-60"
                >
                  {busy && (
                    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                  )}
                  Resume AI
                </button>
              )}
            </div>
          )}

          {/* Free/expired plan banner: the AI is off, the owner replies by hand. */}
          {aiPaused && !paused && (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 sm:px-6">
              <CircleAlert className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
              <p className="min-w-0 flex-1 text-sm text-gray-900">
                Your AI is paused. You have{" "}
                <span className="font-semibold">{manualRemaining}</span> free
                manual replies left this month. Upgrade to restore AI.
              </p>
              <Link
                href="/billing"
                className="inline-flex items-center gap-1.5 rounded-lg bg-colly px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-colly-hover"
              >
                Upgrade
              </Link>
            </div>
          )}

          {/* Messages */}
          <div className="mt-4 rounded-lg border border-gray-200 bg-surface px-4 py-5 sm:px-6">
            {messages && messages.length > 0 ? (
              <div className="space-y-4">
                {messages.map((message) => (
                  <ChatBubble
                    key={message.id}
                    sender={message.sender}
                    content={message.content}
                    createdAt={message.createdAt}
                  />
                ))}
                <div ref={bottomRef} />
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-gray-400">
                No messages in this conversation yet.
              </p>
            )}
          </div>

          {/* Agent composer: open during a human takeover, or while the AI is
              off and the owner still has free manual replies left. */}
          {showComposer && (
            <form
              onSubmit={handleSend}
              className="sticky bottom-16 z-10 mt-4 rounded-lg border border-gray-200 bg-surface p-3 sm:p-4"
            >
              <label htmlFor="agent-reply" className="sr-only">
                Reply as an agent
              </label>
              <div className="flex items-end gap-2">
                <textarea
                  id="agent-reply"
                  rows={1}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    // Enter sends; Shift+Enter adds a line break.
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                  placeholder="Type your reply as a human agent..."
                  className={`${INPUT_CLASS} max-h-40 min-h-[42px] resize-y`}
                />
                <button
                  type="submit"
                  disabled={sending || draft.trim().length === 0}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-colly px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-colly-hover disabled:opacity-60"
                >
                  {sending ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Send className="h-4 w-4" aria-hidden />
                  )}
                  Send
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}

/** Static shell shown until the conversation id is available on the client. */
function ConversationDetailFallback() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link
        href="/conversations"
        className="mb-4 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to Conversations
      </Link>

      <div className="rounded-lg border border-gray-200 bg-surface p-6">
        <div className="h-5 w-40 animate-pulse rounded bg-gray-100" />
        <div className="mt-6 space-y-4">
          <div className="h-10 w-2/3 animate-pulse rounded-2xl bg-gray-100" />
          <div className="ml-auto h-10 w-1/2 animate-pulse rounded-2xl bg-gray-100" />
          <div className="h-10 w-3/5 animate-pulse rounded-2xl bg-gray-100" />
        </div>
      </div>
    </div>
  );
}
