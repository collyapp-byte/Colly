"use client";

import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CircleAlert,
  Download,
  Hand,
  LoaderCircle,
  PauseCircle,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { ChatBubble } from "@/components/conversations/chat-bubble";
import { StatusBadge } from "@/components/conversations/status-badge";
import { formatClockTime, isInFuture } from "@/lib/format";

// The open conversation is refetched on this interval so agent replies and new
// customer messages appear without a manual reload.
const POLL_INTERVAL_MS = 5000;

// Pill-shaped composer input: a one-line field that grows with the draft, so
// the reply bar reads like a chat app rather than a dashboard form.
const COMPOSER_INPUT_CLASS =
  "max-h-40 min-h-[44px] w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-colly focus:bg-white focus:ring-2 focus:ring-colly/20";

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

/**
 * Up to two initials for the header avatar ("Ada Obi" -> "AO"), so the chat
 * header reads like a contact row in a messenger.
 */
function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "?";

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
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

  // Keep the newest message in view: jump there on first load, glide when one
  // arrives (poll result or the owner's own reply) so the list moves the way a
  // native chat scrolls.
  useEffect(() => {
    if (messageCount > lastMessageCount.current) {
      bottomRef.current?.scrollIntoView({
        block: "end",
        behavior: lastMessageCount.current === 0 ? "auto" : "smooth",
      });
    }
    lastMessageCount.current = messageCount;
  }, [messageCount]);

  // Auto-resize the composer: start at one line and grow with the draft, up to
  // the max height. The height is reset first so the textarea can shrink again
  // after a send (`scrollHeight` never reports less than the current height).
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [draft]);

  // An expired timestamp means the takeover has lapsed and the AI is active.
  const paused = conversation?.pausedUntil
    ? isInFuture(conversation.pausedUntil)
    : false;

  // Conversation.status is "AI_HANDLING", "HUMAN_TAKEOVER" or "ESCALATED".
  // Seeded demo rows still carry the legacy "OPEN" value, which behaves like
  // AI_HANDLING here.
  const status = conversation?.status.toUpperCase() ?? "";
  const isEscalated = status === "ESCALATED";
  const isHumanTakeover = status === "HUMAN_TAKEOVER";

  // The AI is off (free/expired plan or an active takeover); the owner answers
  // by hand. The composer stays open while free manual replies remain.
  const aiPaused = plan?.aiPaused ?? false;
  const manualRemaining = plan?.manualMessagesRemaining ?? 0;
  const canReplyManually = manualRemaining > 0;
  // An escalated chat is waiting on the owner ("AI Paused"), so it gets the
  // banner instead of the composer until the owner takes it over.
  const showComposer =
    !isEscalated && (paused || (aiPaused && canReplyManually));

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

  function handleDownloadTranscript() {
    if (!conversation || !messages) return;

    const lines = messages.map((message) => {
      const sender =
        message.sender === "customer"
          ? conversation.customer.name
          : message.sender === "agent"
            ? "Agent"
            : "Colly AI";
      return `[${new Date(message.createdAt).toLocaleString("en-NG")}] ${sender}: ${message.content}`;
    });

    const header = `Conversation with ${conversation.customer.name} (${conversation.customer.phone})\n\n`;
    const blob = new Blob([header + lines.join("\n")], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `transcript-${conversation.id}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success("Transcript downloaded");
  }

  async function handleSend(event: FormEvent<HTMLFormElement>) {    event.preventDefault();

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
      {/* Until the chat header exists (first paint or a failed fetch) keep a
          plain way back; afterwards the sticky header owns that control. */}
      {!conversation && (
        <Link
          href="/conversations"
          className="mb-4 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to Conversations
        </Link>
      )}

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
          {/* Sticky chat header: back, the customer and the takeover control
              pinned to the top right, the way a native chat app arranges it.
              On mobile it parks under the dashboard top bar (h-14). */}
          <div className="sticky top-14 z-20 -mx-4 -mt-4 flex items-center gap-2 border-b border-gray-200 bg-white px-3 py-2.5 shadow-sm md:top-0 md:-mx-6 md:-mt-6 md:gap-3 md:px-6 md:py-3">
            <Link
              href="/conversations"
              aria-label="Back to Conversations"
              title="Back to Conversations"
              className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </Link>

            <div
              aria-hidden
              className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-colly-light text-sm font-semibold text-colly sm:flex"
            >
              {getInitials(conversation.customer.name)}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="truncate font-display text-base font-semibold text-gray-900 sm:text-lg">
                  {conversation.customer.name}
                </h1>
                <StatusBadge status={conversation.status} />
              </div>
              <p className="truncate text-xs text-gray-500 sm:text-sm">
                {conversation.customer.phone}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadTranscript}
                aria-label="Download transcript"
                title="Download transcript"
                className="inline-flex min-h-[44px] min-w-[40px] items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
              >
                <Download className="h-4 w-4" aria-hidden />
              </button>

              {isHumanTakeover ? (
                <button
                  type="button"
                  onClick={handleResumeAi}
                  disabled={busy}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-green-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-green-700 disabled:opacity-60 sm:px-4 sm:text-sm"
                >
                  {busy ? (
                    <LoaderCircle
                      className="h-4 w-4 animate-spin"
                      aria-hidden
                    />
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
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-colly px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-colly-hover disabled:opacity-60 sm:px-4 sm:text-sm"
                  >
                    {busy ? (
                      <LoaderCircle
                        className="h-4 w-4 animate-spin"
                        aria-hidden
                      />
                    ) : (
                      <Hand className="h-4 w-4" aria-hidden />
                    )}
                    Take Over
                  </button>
                )
              )}
            </div>
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
              {!isHumanTakeover && (
                <button
                  type="button"
                  onClick={handleResumeAi}
                  disabled={busy}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-colly px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-colly-hover disabled:opacity-60"
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

          {/* Messages: a light canvas with WhatsApp-style bubbles. */}
          <div className="mt-3 rounded-2xl border border-gray-200 bg-white px-3 py-4 sm:px-4 sm:py-5">
            {messages && messages.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                {messages.map((message) => (
                  <ChatBubble
                    key={message.id}
                    sender={message.sender}
                    content={message.content}
                    createdAt={message.createdAt}
                  />
                ))}
                {/* Auto-scroll target. `scroll-mb-28` keeps the newest bubble
                    clear of the sticky composer when it is scrolled into view. */}
                <div ref={bottomRef} className="scroll-mb-28" />
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-gray-400">
                No messages in this conversation yet.
              </p>
            )}
          </div>

          {/* Escalated chats are waiting on the owner: the AI is paused and the
              composer stays closed until the chat is taken over, so the banner
              replaces the input bar. */}
          {isEscalated && (
            <div className="sticky bottom-16 z-10 -mx-4 mt-3 flex flex-wrap items-center gap-3 border-t border-amber-200 bg-amber-50 px-4 py-3 md:bottom-0 md:-mx-6 md:px-6">
              <PauseCircle
                className="h-5 w-5 shrink-0 text-amber-600"
                aria-hidden
              />
              <p className="min-w-0 flex-1 text-sm font-semibold text-amber-900">
                AI Paused - Waiting for Owner
              </p>
              {!paused && (
                <button
                  type="button"
                  onClick={handleTakeOver}
                  disabled={busy}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-60"
                >
                  {busy ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Hand className="h-4 w-4" aria-hidden />
                  )}
                  Take Over
                </button>
              )}
            </div>
          )}

          {/* Agent composer: open during a human takeover, or while the AI is
              off and the owner still has free manual replies left. It sticks to
              the bottom of the screen like a native chat input bar (offset on
              mobile so the tab bar stays reachable). */}
          {showComposer && (
            <form
              onSubmit={handleSend}
              className="sticky bottom-16 z-10 -mx-4 mt-3 border-t border-gray-200 bg-white p-4 md:bottom-0 md:-mx-6"
            >
              <label htmlFor="agent-reply" className="sr-only">
                Reply as an agent
              </label>
              <div className="flex items-end gap-2">
                <textarea
                  id="agent-reply"
                  ref={textareaRef}
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
                  className={COMPOSER_INPUT_CLASS}
                />
                <button
                  type="submit"
                  disabled={sending || draft.trim().length === 0}
                  aria-label="Send reply"
                  title="Send reply"
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FF6600] text-white shadow-sm transition-colors hover:bg-colly-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sending ? (
                    <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden />
                  ) : (
                    <Send className="h-5 w-5" aria-hidden />
                  )}
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
