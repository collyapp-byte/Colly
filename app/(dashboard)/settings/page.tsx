/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
export const instant = false;

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { CheckCircle2, CircleAlert, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

const SECTION_CLASS = "rounded-lg border border-gray-200 bg-surface p-5 sm:p-6";
const HEADING_CLASS = "font-display text-base tracking-wide text-gray-900";
const LABEL_CLASS = "mb-1 block text-sm font-medium text-gray-700";
const HINT_CLASS = "mt-1 text-xs text-gray-500";
const INPUT_CLASS =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-colly focus:ring-2 focus:ring-colly/20";

const TONE_OPTIONS = [
  {
    value: "friendlyPidgin",
    label: "Friendly Pidgin & English",
    description: "Warm, casual, contractions, light emoji",
  },
  {
    value: "strictProfessional",
    label: "Strict Professional English",
    description: "Formal, no slang, complete sentences",
  },
] as const;

type ToneValue = (typeof TONE_OPTIONS)[number]["value"];

type FormState = {
  businessName: string;
  phone: string;
  operatingHours: string;
  tone: ToneValue;
};

function toFormState(business: any): FormState {
  return {
    businessName: business.name,
    phone: business.phone,
    operatingHours: business.businessHours ?? "",
    tone: (business.tone as ToneValue) || "strictProfessional",
  };
}

export default function SettingsPage() {
  const [form, setForm] = useState<FormState | null>(null);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [role, setRole] = useState<"OWNER" | "STAFF" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"business" | "ai" | "billing">("business");

  const isOwner = role !== "STAFF";

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/business");
        if (res.status === 401) {
          throw new Error("You need to sign in to view your settings.");
        }
        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }
        const data = await res.json();
        if (!active) return;
        setForm(toFormState(data.business));
        setOwnerEmail(data.ownerEmail);
        setRole(data.role === "STAFF" ? "STAFF" : "OWNER");
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

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 4000);
    return () => clearTimeout(timer);
  }, [saved]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/business", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to save settings");
      }

      const data: { business: any } = await res.json();
      setForm(toFormState(data.business));
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  const loading = form === null && error === null;

  function ErrorBlock({
    message,
    className = "",
  }: {
    message: string;
    className?: string;
  }) {
    return (
      <div
        role="alert"
        className={`flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger ${className}`}
      >
        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>{message}</p>
      </div>
    );
  }

  function SettingsSkeleton() {
    return (
      <div className="mt-6 space-y-6">
        {[0, 1].map((card) => (
          <div
            key={card}
            className="rounded-lg border border-gray-200 bg-surface p-5 sm:p-6"
          >
            <div className="h-4 w-40 animate-pulse rounded bg-gray-100" />
            <div className="mt-4 space-y-3">
              <div className="h-9 w-full animate-pulse rounded bg-gray-100" />
              <div className="h-9 w-full animate-pulse rounded bg-gray-100" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="font-display text-2xl text-gray-900">Settings</h1>
      <p className="mt-1 text-sm text-gray-500">
        Manage your business profile and how your AI assistant talks to
        customers.
      </p>

      {/* Tab Navigation */}
      <div className="mt-4 flex gap-2">
        <button
          className={`px-4 py-2 rounded-lg border ${
            activeTab === "business"
              ? "border-colly bg-colly-light border-colly-light"
              : "border-gray-300 hover:border-gray-400"
          }`}
          onClick={() => setActiveTab("business")}
        >
          Business
        </button>
        <button
          className={`px-4 py-2 rounded-lg border ${
            activeTab === "ai"
              ? "border-colly bg-colly-light border-colly-light"
              : "border-gray-300 hover:border-gray-400"
          }`}
          onClick={() => setActiveTab("ai")}
        >
          AI & Channels
        </button>
        <button
          className={`px-4 py-2 rounded-lg border ${
            activeTab === "billing"
              ? "border-colly bg-colly-light border-colly-light"
              : "border-gray-300 hover:border-gray-400"
          }`}
          onClick={() => setActiveTab("billing")}
        >
          Billing & Replies
        </button>
      </div>

      {activeTab === "business" && (
        <form id="settings-form" onSubmit={handleSubmit} className="mt-6 space-y-6">
          {/* BUSINESS PROFILE */}
          <section className={SECTION_CLASS}>
            <h2 className={HEADING_CLASS}>BUSINESS PROFILE</h2>
            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="business-name" className={LABEL_CLASS}>
                  Business name
                </label>
                <input
                  id="business-name"
                  value={form?.businessName || ""}
                  onChange={(e) => update("businessName", e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label htmlFor="business-phone" className={LABEL_CLASS}>
                  Phone number
                </label>
                <input
                  id="business-phone"
                  value={form?.phone || ""}
                  onChange={(e) => update("phone", e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label htmlFor="business-hours" className={LABEL_CLASS}>
                  Operating hours
                </label>
                <input
                  id="business-hours"
                  value={form?.operatingHours || ""}
                  onChange={(e) => update("operatingHours", e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="Mon-Fri 9am-6pm, Sat 10am-4pm"
                />
              </div>
            </div>
          </section>

          {/* AI COMMUNICATION TONE */}
          <section className={SECTION_CLASS}>
            <h2 className={HEADING_CLASS}>AI COMMUNICATION TONE</h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {TONE_OPTIONS.map((option) => {
                const selected = form?.tone === option.value;
                return (
                  <label
                    key={option.value}
                    className={`cursor-pointer rounded-lg border p-4 transition-colors ${
                      selected ? "border-colly bg-colly-light" : "border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="tone"
                        value={option.value}
                        checked={selected}
                        onChange={() => update("tone", option.value)}
                        className="h-4 w-4 accent-colly"
                      />
                      <span className="text-sm font-semibold text-gray-900">
                        {option.label}
                      </span>
                    </span>
                    <span className="mt-1 block text-xs text-gray-500">
                      {option.description}
                    </span>
                  </label>
                );
              })}
            </div>
          </section>

          {/* TEAM MANAGEMENT LINK */}
          {isOwner && (
            <div className="mt-6">
              <Link
                href="/settings/team"
                className="inline-flex items-center gap-1 text-sm font-medium text-colly transition-colors hover:text-colly-hover"
              >
                Manage team →
              </Link>
            </div>
          )}

          {/* SAVE CHANGES BUTTON */}
          <div className="mt-6">
            <Button
              type="submit"
              form="settings-form"
              variant="primary"
              loading={saving}
            >
              Save Changes
            </Button>
          </div>
        </form>
      )}

      {activeTab === "ai" && (
        <div className="mt-6 space-y-6">
          {/* AI & CHANNELS */}
          <section className={SECTION_CLASS}>
            <h2 className={HEADING_CLASS}>AI & CHANNELS</h2>
            <div className="mt-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="font-medium text-gray-900">Telegram</h3>
                  <div className="mt-2 p-3 rounded-lg border border-blue-500 bg-blue-50/10">
                    <span className="text-sm text-blue-600">Connected</span>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    Messages routed through your Telegram bot.
                  </p>
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">Web Chat</h3>
                  <div className="mt-2 p-3 rounded-lg border border-green-500 bg-green-50/10">
                    <span className="text-sm text-green-600">Active</span>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    Web chat widget live on your site.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ADVANCED SETTINGS ACCORDION */}
          <section className={SECTION_CLASS}>
            <h2 className={HEADING_CLASS}>ADVANCED SETTINGS</h2>
            <div className="mt-4">
              <details className="cursor-pointer">
                <summary
                  className="flex items-center gap-2 py-2 px-3 rounded-lg border border-gray-300 hover:border-gray-400"
                >
                  <svg
                    className="h-4 w-4 text-gray-500"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M7 10l5 5 5-5z" />
                  </svg>
                  Advanced configuration
                </summary>
                <div className="mt-4 p-4 rounded-lg border border-gray-200 bg-gray-50">
                  <h3 className="font-medium text-gray-900 mb-3">
                    Web Chat Embed Snippet
                  </h3>
                  <textarea
                    rows={3}
                    className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-colly focus:ring-2 focus:ring-colly/20 resize-height`}
                    placeholder="Your web chat embed code will appear here..."
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    This snippet embeds the web chat widget directly onto your site.
                  </p>
                </div>
              </details>
            </div>
          </section>
        </div>
      )}

      {activeTab === "billing" && (
        <div className="mt-6 space-y-6">
          {/* BILLING & REPLIES */}
          <section className={SECTION_CLASS}>
            <h2 className={HEADING_CLASS}>BILLING & REPLIES</h2>
            <div className="mt-4">
              {/* Metric Card: Available AI Replies */}
              <div className="rounded-lg border border-gray-200 bg-surface p-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-display font-bold text-gray-900">1,250</span>
                  <span className="text-xl text-gray-500">Available AI Replies</span>
                </div>
                <p className="mt-1 text-sm text-gray-500">
                  Your AI has processed 1,250 replies this period.
                </p>
              </div>
            </div>
          </section>

          {/* PLAN STATUS */}
          <section className={SECTION_CLASS}>
            <h2 className={HEADING_CLASS}>PLAN STATUS</h2>
            <div className="mt-4">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div>
                  <p className="text-sm text-gray-500">Current Plan</p>
                  <p className="font-medium text-gray-900">Pro</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Replies Used</p>
                  <p className="font-medium text-gray-900">850/1,250</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Expires</p>
                  <p className="font-medium text-gray-900">Jan 15, 2027</p>
                </div>
              </div>
            </div>
          </section>

          {/* ACTION BUTTONS */}
          <section className={SECTION_CLASS}>
            <h2 className={HEADING_CLASS}>ACTIONS</h2>
            <div className="mt-4 flex gap-3">
              <Button variant="secondary">Top Up Replies</Button>
              <Link
                href="/settings/billing"
                className="inline-flex items-center gap-1 text-sm font-medium text-colly transition-colors hover:text-colly-hover"
              >
                View Plans
              </Link>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
