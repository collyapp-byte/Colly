"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Loader2, MessageCircle, Send } from "lucide-react";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
};

type BusinessState = "loading" | "ready" | "missing";

const VISITOR_STORAGE_KEY = "colly-web-chat-visitor";
const MAX_MESSAGE_LENGTH = 2000;
const ERROR_REPLY =
  "Sorry, I could not send that. Please check your connection and try again.";

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Stable per-browser visitor id so a reload continues the same conversation. */
function getOrCreateVisitorId(): string {
  try {
    const existing = window.localStorage.getItem(VISITOR_STORAGE_KEY);
    if (existing) return existing;
    const created = createId();
    window.localStorage.setItem(VISITOR_STORAGE_KEY, created);
    return created;
  } catch {
    // Private mode / storage disabled: fall back to a session-only id.
    return createId();
  }
}

export default function PublicChat({ businessId }: { businessId: string }) {
  const [businessState, setBusinessState] = useState<BusinessState>("loading");
  const [businessName, setBusinessName] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const visitorIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/chat/web?businessId=${encodeURIComponent(businessId)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Business not found");
        return (await res.json()) as { business?: { name?: string } };
      })
      .then((data) => {
        if (cancelled) return;
        if (!data.business?.name) {
          setBusinessState("missing");
          return;
        }
        setBusinessName(data.business.name);
        setBusinessState("ready");
      })
      .catch(() => {
        if (!cancelled) setBusinessState("missing");
      });

    return () => {
      cancelled = true;
    };
  }, [businessId]);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, sending]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = input.trim();
    if (!text || sending) return;

    const customerId =
      visitorIdRef.current ??
      (visitorIdRef.current = getOrCreateVisitorId());

    setMessages((current) => [
      ...current,
      { id: createId(), role: "user", content: text },
    ]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/chat/web", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, customerId, message: text }),
      });

      const data = (await res.json().catch(() => null)) as {
        reply?: string;
      } | null;

      if (!res.ok || !data?.reply) {
        throw new Error("Request failed");
      }

      const reply = data.reply;
      setMessages((current) => [
        ...current,
        { id: createId(), role: "assistant", content: reply },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        { id: createId(), role: "assistant", content: ERROR_REPLY },
      ]);
    } finally {
      setSending(false);
    }
  }

  if (businessState === "missing") {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-background px-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-colly-light text-colly">
            <MessageCircle className="h-6 w-6" aria-hidden />
          </div>
          <h1 className="font-display text-lg text-gray-900">
            Chat unavailable
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            This chat link is invalid or the business is no longer accepting
            messages.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex h-[100dvh] flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-gray-200 bg-surface px-4 py-3 shadow-sm">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-colly text-base font-semibold text-white">
          {(businessName ?? "C").charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h1 className="truncate font-display text-sm tracking-wide text-gray-900">
            {businessName ?? "Live chat"}
          </h1>
          <p className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            AI assistant online
          </p>
        </div>
      </header>

      <div
        ref={listRef}
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4"
      >
        {businessState === "loading" ? (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-gray-200 bg-surface px-4 py-3 text-sm text-gray-500 shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading chat...
            </div>
          </div>
        ) : null}

        {businessState === "ready" && messages.length === 0 ? (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-gray-200 bg-surface px-4 py-3 text-sm leading-relaxed text-gray-800 shadow-sm">
              {businessName ? `Hi! Welcome to ${businessName}.` : "Hi there!"}{" "}
              How can I help you today?
            </div>
          </div>
        ) : null}

        {messages.map((message) => (
          <div
            key={message.id}
            className={
              message.role === "user" ? "flex justify-end" : "flex justify-start"
            }
          >
            <div
              className={
                message.role === "user"
                  ? "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-colly px-4 py-2.5 text-sm leading-relaxed text-white shadow-sm"
                  : "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-bl-md border border-gray-200 bg-surface px-4 py-2.5 text-sm leading-relaxed text-gray-800 shadow-sm"
              }
            >
              {message.content}
            </div>
          </div>
        ))}

        {sending ? (
          <div className="flex justify-start">
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-gray-200 bg-surface px-4 py-3 shadow-sm">
              <span className="sr-only">Assistant is typing</span>
              <span
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400"
                style={{ animationDelay: "-0.3s" }}
              />
              <span
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400"
                style={{ animationDelay: "-0.15s" }}
              />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" />
            </div>
          </div>
        ) : null}
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-gray-200 bg-surface p-3"
      >
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Type your message..."
            maxLength={MAX_MESSAGE_LENGTH}
            disabled={businessState !== "ready" || sending}
            aria-label="Message"
            className="h-11 flex-1 rounded-full border border-gray-300 bg-background px-4 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-colly focus:ring-2 focus:ring-colly/20 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={
              businessState !== "ready" || sending || input.trim().length === 0
            }
            aria-label="Send message"
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-colly text-white transition-colors hover:bg-colly-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            ) : (
              <Send className="h-5 w-5" aria-hidden />
            )}
          </button>
        </div>
      </form>
    </main>
  );
}
