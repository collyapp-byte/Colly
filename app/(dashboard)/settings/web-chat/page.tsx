"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Code2,
  Copy,
  ExternalLink,
  Globe,
  ImagePlus,
  Loader2,
  QrCode,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Business } from "@/lib/business";
import {
  deleteBusinessAvatar,
  uploadBusinessAvatar,
} from "@/lib/supabase/storage";

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

/** Largest profile picture we accept before it is even uploaded. */
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export default function WebChatSettingsPage() {
  const [business, setBusiness] = useState<Business | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

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

  /**
   * Persists the picture on the business. The URL is always one the browser just
   * uploaded to Colly's Storage bucket; the API re-validates it (public Storage
   * URL + `/businessId/` prefix) before saving.
   */
  async function saveAvatar(avatarUrl: string): Promise<Business> {
    const res = await fetch("/api/business", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatarUrl }),
    });
    const data = (await res.json().catch(() => null)) as {
      business?: Business;
      error?: string;
    } | null;

    if (!res.ok || !data?.business) {
      throw new Error(data?.error ?? "Could not save your picture.");
    }

    setBusiness(data.business);
    return data.business;
  }

  async function handleAvatarUpload(file: File) {
    if (!business || avatarBusy) return;

    setAvatarError(null);

    if (!file.type.startsWith("image/")) {
      setAvatarError("Choose an image file (PNG, JPG, WEBP or GIF).");
      return;
    }

    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError("That picture is larger than 5 MB. Please choose a smaller one.");
      return;
    }

    const previous = business.avatarUrl;
    setAvatarBusy(true);

    try {
      const url = await uploadBusinessAvatar(business.id, file);
      await saveAvatar(url);
      toast.success("Profile picture updated");

      // Best effort: drop the replaced object so the bucket does not grow with
      // every re-upload. A failure here leaves the saved picture untouched.
      if (previous) {
        try {
          await deleteBusinessAvatar(previous);
        } catch (cleanupError) {
          console.warn("[web-chat] could not delete the old avatar", cleanupError);
        }
      }
    } catch (err) {
      setAvatarError(
        err instanceof Error ? err.message : "Could not upload your picture.",
      );
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handleAvatarRemove() {
    if (!business || avatarBusy || !business.avatarUrl) return;

    const previous = business.avatarUrl;
    setAvatarError(null);
    setAvatarBusy(true);

    try {
      await saveAvatar("");
      toast.success("Profile picture removed");
      try {
        await deleteBusinessAvatar(previous);
      } catch (cleanupError) {
        console.warn("[web-chat] could not delete the old avatar", cleanupError);
      }
    } catch (err) {
      setAvatarError(
        err instanceof Error ? err.message : "Could not remove your picture.",
      );
    } finally {
      setAvatarBusy(false);
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
                <Link
                  href="/settings/qr-code"
                  className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-gray-100 px-3 py-1.5 text-[13px] font-semibold text-gray-900 transition-colors hover:bg-gray-200"
                >
                  <QrCode className="h-4 w-4" aria-hidden />
                  Get In-Store QR Code
                </Link>
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
                <ImagePlus className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <h2 className={HEADING_CLASS}>Business profile picture</h2>
                <p className={HINT_CLASS}>
                  Shown at the top of the chat so customers know they are talking
                  to you. Leave it empty to show the first letter of your business
                  name.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-4">
              {business.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={business.avatarUrl}
                  alt={`${business.name} profile picture`}
                  className="h-16 w-16 rounded-full object-cover ring-1 ring-gray-200"
                />
              ) : (
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-colly text-xl font-semibold text-white">
                  {business.name.charAt(0).toUpperCase()}
                </span>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <input
                  id="web-chat-avatar"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="sr-only"
                  disabled={avatarBusy}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    // Reset so choosing the same file twice still fires onChange.
                    event.target.value = "";
                    if (file) void handleAvatarUpload(file);
                  }}
                />
                <label
                  htmlFor="web-chat-avatar"
                  aria-disabled={avatarBusy}
                  className={`inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-gray-300 bg-gray-100 px-3 py-1.5 text-[13px] font-semibold text-gray-900 transition-colors hover:bg-gray-200 ${
                    avatarBusy ? "pointer-events-none opacity-60" : ""
                  }`}
                >
                  {avatarBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Upload className="h-4 w-4" aria-hidden />
                  )}
                  {business.avatarUrl ? "Replace picture" : "Upload picture"}
                </label>

                {business.avatarUrl ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={avatarBusy}
                    onClick={handleAvatarRemove}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" aria-hidden />
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>

            <p className="mt-3 text-xs text-gray-500">
              PNG, JPG, WEBP or GIF, up to 5 MB. Square pictures look best.
            </p>
            {avatarError ? (
              <p className="mt-1 text-sm text-danger">{avatarError}</p>
            ) : null}
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
