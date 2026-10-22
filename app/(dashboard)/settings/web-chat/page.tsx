"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Code2, Copy, ExternalLink, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Business } from "@/lib/business";

const WEB_CHAT_ORIGIN = "https://colly.com.ng";

const SECTION_CLASS = "rounded-lg border border-gray-200 bg-surface p-5 sm:p-6";
const HEADING_CLASS = "font-display text-base tracking-wide text-gray-900";
const HINT_CLASS = "mt-1 text-xs text-gray-500";
const INPUT_CLASS =
  "w-full rounded-lg border border-gray-300 bg-background px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-colly focus:ring-2 focus:ring-colly/20";

/** Copies text to the clipboard, with a fallback for older browsers. */
async function copyToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export default function WebChatSettingsPage() {
  const [business, setBusiness] = useState<Business | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    fetch("/api/business")
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(
            res.status === 401
              ? "You need to sign in to manage web chat."
              : `Request failed with status ${res.status}`,
          );
        }
        return (await res.json()) as { business?: Business };
      })
      .then((data) => {
        if (!active) return;
        if (!data.business) throw new Error("Business not found");
        setBusiness(data.business);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(
          err instanceof Error ? err.message : "Could not load your business.",
        );
      });

    return () => {
      active = false;
    };
  }, []);

  const chatLink = business ? `${WEB_CHAT_ORIGIN}/chat/${business.id}` : "";
  const embedCode = business
    ? `<iframe src="${chatLink}" width="100%" height="600px" style="border:none; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);"></iframe>`
    : "";

  async function handleCopy(value: string, label: string) {
    if (!value) return;
    try {
      await copyToClipboard(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Could not copy. Select the text and copy it manually.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Link
        href="/settings"
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-colly"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to settings
      </Link>

      <h1 className="font-display text-2xl text-gray-900">Web Chat</h1>
      <p className="mt-1 text-sm text-gray-500">
        Add an AI chat widget to your website so customers can ask about your
        products without leaving the page.
      </p>

      {error ? (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {!business && !error ? (
        <div className="mt-6 space-y-6">
          {[0, 1].map((card) => (
            <div
              key={card}
              className={`${SECTION_CLASS} animate-pulse space-y-3`}
            >
              <div className="h-4 w-40 rounded bg-gray-100" />
              <div className="h-10 w-full rounded-lg bg-gray-100" />
              <div className="h-9 w-28 rounded-lg bg-gray-100" />
            </div>
          ))}
        </div>
      ) : null}

      {business ? (
        <div className="mt-6 space-y-6">
          <section className={SECTION_CLASS}>
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-colly-light text-colly">
                <Globe className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <h2 className={HEADING_CLASS}>Your chat link</h2>
                <p className={HINT_CLASS}>
                  Share this link anywhere customers can reach you. It opens the
                  chat in a full page.
                </p>
              </div>
            </div>

            <div className="mt-4">
              <label
                htmlFor="web-chat-link"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Public link
              </label>
              <input
                id="web-chat-link"
                value={chatLink}
                readOnly
                onFocus={(event) => event.currentTarget.select()}
                className={`${INPUT_CLASS} font-mono text-xs`}
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handleCopy(chatLink, "Chat link")}
                >
                  <Copy className="mr-1.5 h-4 w-4" aria-hidden />
                  Copy Link
                </Button>
                <a
                  href={chatLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold text-colly transition-colors hover:text-colly-hover"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden />
                  Open chat
                </a>
              </div>
            </div>
          </section>

          <section className={SECTION_CLASS}>
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-colly-light text-colly">
                <Code2 className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <h2 className={HEADING_CLASS}>Embed on your website</h2>
                <p className={HINT_CLASS}>
                  Paste this code into any page that accepts HTML, or into a
                  custom HTML block in your site builder.
                </p>
              </div>
            </div>

            <div className="mt-4">
              <label
                htmlFor="web-chat-embed"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Embed code
              </label>
              <textarea
                id="web-chat-embed"
                value={embedCode}
                readOnly
                rows={4}
                onFocus={(event) => event.currentTarget.select()}
                className={`${INPUT_CLASS} resize-none font-mono text-xs leading-relaxed`}
              />
              <div className="mt-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handleCopy(embedCode, "Embed code")}
                >
                  <Copy className="mr-1.5 h-4 w-4" aria-hidden />
                  Copy Code
                </Button>
              </div>
            </div>
          </section>

          <section className={SECTION_CLASS}>
            <h2 className={HEADING_CLASS}>How it works</h2>
            <ul className="mt-3 space-y-2 text-sm text-gray-600">
              <li className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-colly" />
                Visitors get instant answers from your products, FAQs, and
                business details.
              </li>
              <li className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-colly" />
                Every conversation appears in your Conversations dashboard, just
                like WhatsApp and Telegram.
              </li>
              <li className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-colly" />
                Reply manually any time by taking over the conversation.
              </li>
            </ul>
          </section>
        </div>
      ) : null}
    </div>
  );
}
