"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Send, Sparkles, X } from "lucide-react";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: number;
  role: ChatRole;
  content: string;
};

type CollyAiWidgetProps = {
  /** Shown in the welcome message so the assistant feels personal. */
  ownerName?: string | null;
};

/**
 * The persistent "Colly AI" assistant that floats in the bottom-right corner of
 * every dashboard page. It posts to `/api/chat` with `isDashboardAssistant: true`
 * so the backend knows it is talking to the owner, not a customer.
 */
export function CollyAiWidget({ ownerName }: CollyAiWidgetProps) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [nextId, setNextId] = useState(1);

  const bodyRef = useRef<HTMLDivElement>(null);

  const greeting = ownerName?.trim()
    ? `Hi ${ownerName.trim()}!`
    : "Hi there!";

  const welcome: ChatMessage = {
    id: 0,
    role: "assistant",
    content: `${greeting} I'm Colly AI. How can I help you manage your business today?`,
  };

  // Keep the newest message in view as the thread grows.
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages, sending, open]);

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    const userMessage: ChatMessage = { id: nextId, role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);
    setNextId((id) => id + 2);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, isDashboardAssistant: true }),
      });
      const data = (await res.json().catch(() => null)) as
        | { reply?: string | null; error?: string }
        | null;

      const reply =
        data?.reply ??
        data?.error ??
        "I could not reach the AI just now. Please try again in a moment.";

      setMessages((prev) => [
        ...prev,
        { id: nextId + 1, role: "assistant", content: reply },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId + 1,
          role: "assistant",
          content:
            "Could not reach the server. Check your connection and try again.",
        },
      ]);
    } finally {
      setNextId((id) => id + 2);
      setSending(false);
    }
  }

  const thread = [welcome, ...messages];

  return (
    <>
      {/* Panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex h-[500px] w-96 max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/5">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 bg-[#FF6600] px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" aria-hidden />
              <span className="font-display text-sm font-semibold">Colly AI</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close Colly AI"
              className="rounded-md p-1 transition-colors hover:bg-white/20"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          {/* Body */}
          <div ref={bodyRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {thread.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                    message.role === "user"
                      ? "bg-[#FF6600] text-white"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1 rounded-2xl bg-gray-100 px-3 py-2">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form
            onSubmit={handleSend}
            className="flex items-center gap-2 border-t border-gray-100 px-3 py-3"
          >
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask Colly AI anything…"
              aria-label="Message Colly AI"
              className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-colly focus:ring-2 focus:ring-colly/20"
            />
            <button
              type="submit"
              disabled={sending || input.trim().length === 0}
              aria-label="Send message"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#FF6600] text-white transition-colors hover:bg-[#E65C00] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-4 w-4" aria-hidden />
            </button>
          </form>
        </div>
      )}

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "Close Colly AI" : "Open Colly AI"}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#FF6600] text-white shadow-lg transition-colors hover:bg-[#E65C00]"
      >
        {open ? (
          <X className="h-6 w-6" aria-hidden />
        ) : (
          <Sparkles className="h-6 w-6" aria-hidden />
        )}
      </button>
    </>
  );
}
