"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, Clock, PhoneCall, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Business } from "@/lib/business";

const SECTION_CLASS = "rounded-lg border border-gray-200 bg-surface p-5 sm:p-6";
const HEADING_CLASS = "font-display text-base tracking-wide text-gray-900";

/** The Two-Number Model explained in the owner's own words. */
const HOW_IT_WORKS = [
  "Your personal WhatsApp stays exactly as it is. You keep your chats, your Status, and your phone.",
  "We assign you a dedicated AI line. When customers message this new number, the AI replies instantly.",
  "You can put the AI line number on your Instagram bio, your WhatsApp Status, and your business cards.",
];

export default function AiLinePage() {
  const [business, setBusiness] = useState<Business | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const res = await fetch("/api/business");
        if (res.status === 401) {
          throw new Error("You need to sign in to view your AI line.");
        }
        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }
        const data: { business?: Business } = await res.json();
        if (active && data.business) setBusiness(data.business);
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

  const loading = business === null && error === null;
  const connected = business?.aiLineConnected === true;
  const hasAgent = Boolean(business?.referredByAgentId);

  function handleRequest() {
    setRequested(true);
    window.alert(
      "Our team will contact you to set up your line within 24 hours",
    );
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

      <h1 className="font-display text-2xl text-gray-900">AI Line</h1>
      <p className="mt-1 text-sm text-gray-500">
        Your dedicated Colly AI line — kept separate from your personal
        WhatsApp.
      </p>

      {loading && <AiLineSkeleton />}

      {!business && error && (
        <div
          role="alert"
          className="mt-6 flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger"
        >
          <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{error}</p>
        </div>
      )}

      {business && (
        <div className="mt-6 space-y-6">
          {/* CURRENT STATUS */}
          <section className={SECTION_CLASS}>
            <h2 className={HEADING_CLASS}>CURRENT STATUS</h2>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {connected ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-100 px-3 py-1.5 text-[13px] font-medium text-green-700">
                  <BadgeCheck className="h-4 w-4" aria-hidden />
                  Connected &amp; Live
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full border border-[#FF6600]/20 bg-[#FFF4EC] px-3 py-1.5 text-[13px] font-medium text-[#FF6600]">
                  <Clock className="h-4 w-4" aria-hidden />
                  Pending Setup
                </span>
              )}

              {connected && (
                <span className="inline-flex items-center gap-2 text-sm font-medium text-gray-900">
                  <Smartphone className="h-4 w-4 text-gray-500" aria-hidden />
                  {business.phone}
                </span>
              )}
            </div>

            <p className="mt-3 text-sm text-gray-600">
              {connected
                ? "Customers who message your AI line are answered instantly by your AI assistant."
                : "We are preparing your dedicated AI line. Until it is connected, your AI cannot reply to customers."}
            </p>
          </section>

          {/* HOW IT WORKS */}
          <section className={SECTION_CLASS}>
            <h2 className={HEADING_CLASS}>HOW IT WORKS</h2>
            <ul className="mt-4 space-y-3">
              {HOW_IT_WORKS.map((line) => (
                <li key={line} className="flex items-start gap-3 text-sm text-gray-600">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FFF4EC] text-[#FF6600]">
                    <PhoneCall className="h-3 w-3" aria-hidden />
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* NEXT STEP */}
          <section className={SECTION_CLASS}>
            <h2 className={HEADING_CLASS}>NEXT STEP</h2>
            {connected ? (
              <p className="mt-4 text-sm text-gray-600">
                You are all set. Post{" "}
                <span className="font-medium text-gray-900">
                  {business.phone}
                </span>{" "}
                on your WhatsApp Status and Instagram bio so customers can reach
                your AI.
              </p>
            ) : hasAgent ? (
              <p className="mt-4 text-sm text-gray-600">
                Your agent will set this up for you.
              </p>
            ) : (
              <div className="mt-4">
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleRequest}
                  disabled={requested}
                >
                  Request Connection
                </Button>
                {requested && (
                  <p className="mt-2 text-sm text-success">
                    Our team will contact you to set up your line within 24
                    hours.
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

/** Placeholder shown while the business profile loads. */
function AiLineSkeleton() {
  return (
    <div className="mt-6 space-y-6">
      {[0, 1, 2].map((card) => (
        <div
          key={card}
          className="rounded-lg border border-gray-200 bg-surface p-5 sm:p-6"
        >
          <div className="h-4 w-32 animate-pulse rounded bg-gray-100" />
          <div className="mt-4 space-y-3">
            <div className="h-6 w-40 animate-pulse rounded-full bg-gray-100" />
            <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
