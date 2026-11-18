"use client";

import { useState } from "react";
import Link from "next/link";
import { Code2, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { webChatEmbedCode, webChatLink } from "@/lib/web-chat";

/**
 * Web Chat setup inside a Channels card.
 *
 * The widget needs no credential: the embed snippet is derived from the tenant
 * id, so this panel is a copy-and-paste box plus the link to the full
 * customization screen (avatar, how-it-works).
 */

const INPUT_CLASS =
  "w-full rounded-lg border border-card-border bg-card-surface px-3 py-2 text-sm text-main outline-none transition-all duration-250 focus:border-colly focus:ring-2 focus:ring-colly/20";

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

export function WebChatPanel({ businessId }: { businessId: string }) {
  const [copied, setCopied] = useState(false);

  const link = webChatLink(businessId);
  const embedCode = webChatEmbedCode(businessId);

  async function handleCopy() {
    try {
      await copyToClipboard(embedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Embed code copied");
    } catch {
      toast.error("Could not copy. Select the text and copy it manually.");
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-muted">
        Paste this snippet into any page that accepts HTML, or into a custom
        HTML block in your site builder. Every visitor who uses it lands in your
        Conversations inbox.
      </p>

      <div>
        <label
          htmlFor="channels-web-chat-embed"
          className="mb-1 block text-xs font-medium text-main"
        >
          Embed code
        </label>
        <textarea
          id="channels-web-chat-embed"
          value={embedCode}
          readOnly
          rows={4}
          onFocus={(event) => event.currentTarget.select()}
          className={`${INPUT_CLASS} resize-none font-mono text-[11px] leading-relaxed`}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => void handleCopy()}>
          <Copy className="mr-2 h-4 w-4" aria-hidden />
          {copied ? "Copied!" : "Copy embed code"}
        </Button>
        <Link
          href={link}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-colly transition-all duration-250 hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          Preview widget
        </Link>
      </div>

      <div className="rounded-lg border border-card-border bg-card-surface p-3">
        <p className="inline-flex items-center gap-2 text-xs font-semibold text-main">
          <Code2 className="h-3.5 w-3.5 text-colly" aria-hidden />
          Avatar and widget settings
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Add a business picture so visitors recognise the chat, and see the full
          setup guide.
        </p>
        <Link
          href="/settings/web-chat"
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-colly transition-all duration-250 hover:underline"
        >
          Customize web chat
          <ExternalLink className="h-3 w-3" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
