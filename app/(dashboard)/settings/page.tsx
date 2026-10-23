"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { CheckCircle2, CircleAlert, LogOut } from "lucide-react";
import { logout } from "@/lib/auth-actions";
import type { Business, Tone } from "@/lib/business";
import { Button } from "@/components/ui/button";
import { VoiceInput } from "@/components/ui/voice-input";

const SECTION_CLASS = "rounded-lg border border-gray-200 bg-surface p-5 sm:p-6";
const HEADING_CLASS = "font-display text-base tracking-wide text-gray-900";
const LABEL_CLASS = "mb-1 block text-sm font-medium text-gray-700";
const HINT_CLASS = "mt-1 text-xs text-gray-500";
const INPUT_CLASS =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-colly focus:ring-2 focus:ring-colly/20";

const TONE_OPTIONS: { value: Tone; label: string; description: string }[] = [
  {
    value: "formal",
    label: "Formal",
    description: "Professional, no slang, complete sentences",
  },
  {
    value: "friendly",
    label: "Friendly",
    description: "Warm and casual, contractions, light emoji",
  },
];

type FormState = {
  name: string;
  phone: string;
  whatsappNumber: string;
  tone: Tone;
  businessHours: string;
  address: string;
  description: string;
};

/** Flattens an API Business into the editable string state of the form. */
function toFormState(business: Business): FormState {
  return {
    name: business.name,
    phone: business.phone,
    whatsappNumber: business.whatsappNumber,
    tone: business.tone,
    businessHours: business.businessHours ?? "",
    address: business.address ?? "",
    description: business.description ?? "",
  };
}

export default function SettingsPage() {
  const [form, setForm] = useState<FormState | null>(null);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

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
        const data: { business: Business; ownerEmail: string } =
          await res.json();
        if (!active) return;
        setForm(toFormState(data.business));
        setOwnerEmail(data.ownerEmail);
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

  // Auto-dismiss the success toast.
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

      const data: { business: Business } = await res.json();
      setForm(toFormState(data.business));
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  const loading = form === null && error === null;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="font-display text-2xl text-gray-900">Settings</h1>
      <p className="mt-1 text-sm text-gray-500">
        Manage your business profile and how your AI assistant talks to
        customers.
      </p>

      <Link
        href="/settings/billing"
        className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-colly transition-colors hover:text-colly-hover"
      >
        Manage billing →
      </Link>

      {saved && (
        <div
          role="status"
          className="fixed right-4 top-20 z-50 flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm font-medium text-success shadow-lg"
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          Settings saved
        </div>
      )}

      {loading && <SettingsSkeleton />}

      {!form && error && <ErrorBlock className="mt-6" message={error} />}

      {form && (
        <div className="mt-6 space-y-6">
          <form
            id="settings-form"
            onSubmit={handleSubmit}
            className="space-y-6"
          >
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
                    value={form.name}
                    onChange={(event) => update("name", event.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="business-phone" className={LABEL_CLASS}>
                      Phone number
                    </label>
                    <input
                      id="business-phone"
                      value={form.phone}
                      onChange={(event) => update("phone", event.target.value)}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div>
                    <label htmlFor="business-whatsapp" className={LABEL_CLASS}>
                      WhatsApp number
                    </label>
                    <input
                      id="business-whatsapp"
                      value={form.whatsappNumber}
                      onChange={(event) =>
                        update("whatsappNumber", event.target.value)
                      }
                      className={INPUT_CLASS}
                    />
                    <p className={HINT_CLASS}>
                      Your WhatsApp Business number will be connected here once
                      live
                    </p>
                  </div>
                </div>

                <div>
                  <label htmlFor="business-address" className={LABEL_CLASS}>
                    Address
                  </label>
                  <input
                    id="business-address"
                    value={form.address}
                    onChange={(event) => update("address", event.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>

                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <label
                      htmlFor="business-description"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Description
                    </label>
                    <VoiceInput
                      onTranscript={(transcript) =>
                        update(
                          "description",
                          form.description
                            ? `${form.description}\n${transcript}`
                            : transcript,
                        )
                      }
                    />
                  </div>
                  <textarea
                    id="business-description"
                    rows={3}
                    value={form.description}
                    onChange={(event) =>
                      update("description", event.target.value)
                    }
                    className={INPUT_CLASS}
                  />
                  <p className={HINT_CLASS}>
                    What does your business sell? The AI uses this for context.
                  </p>
                </div>
              </div>
            </section>

            {/* AI TONE */}
            <section className={SECTION_CLASS}>
              <h2 className={HEADING_CLASS}>AI TONE</h2>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {TONE_OPTIONS.map((option) => {
                  const selected = form.tone === option.value;
                  return (
                    <label
                      key={option.value}
                      className={`cursor-pointer rounded-lg border p-4 transition-colors ${
                        selected
                          ? "border-colly bg-colly-light"
                          : "border-gray-300 hover:border-gray-400"
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

            {/* BUSINESS HOURS */}
            <section className={SECTION_CLASS}>
              <h2 className={HEADING_CLASS}>BUSINESS HOURS</h2>
              <div className="mt-4">
                <label htmlFor="business-hours" className={LABEL_CLASS}>
                  Opening hours
                </label>
                <input
                  id="business-hours"
                  value={form.businessHours}
                  onChange={(event) =>
                    update("businessHours", event.target.value)
                  }
                  placeholder="Mon-Fri 9am-6pm, Sat 10am-4pm"
                  className={INPUT_CLASS}
                />
              </div>
            </section>
          </form>

          {/* ACCOUNT */}
          <section className={SECTION_CLASS}>
            <h2 className={HEADING_CLASS}>ACCOUNT</h2>
            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="owner-email" className={LABEL_CLASS}>
                  Owner email
                </label>
                <input
                  id="owner-email"
                  value={ownerEmail}
                  readOnly
                  className={`${INPUT_CLASS} cursor-not-allowed bg-gray-50 text-gray-500`}
                />
              </div>

              <form action={logout}>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
                >
                  <LogOut className="h-4 w-4" aria-hidden />
                  Sign out
                </button>
              </form>
            </div>
          </section>

          {error && <ErrorBlock message={error} />}

          <div className="flex justify-end">
            <Button
              type="submit"
              form="settings-form"
              variant="primary"
              loading={saving}
            >
              Save Changes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

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

/** Placeholder cards shown while the profile loads. */
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
