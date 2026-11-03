/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState, FormEvent } from "react";
import Link from "next/link";
import { CheckCircle2, CircleAlert, QrCode, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

const SECTION_CLASS = "rounded-lg border border-gray-200 bg-surface p-5 sm:p-6";
const HEADING_CLASS = "font-display text-base tracking-wide text-gray-900";
const LABEL_CLASS = "mb-1 block text-sm font-medium text-gray-700";
const INPUT_CLASS =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-colly focus:ring-2 focus:ring-colly/20";

// FIXED: Uses the actual tones from the database, not the deprecated pidgin options
const TONE_OPTIONS = [
  {
    value: "friendly",
    label: "Friendly & Casual",
    description: "Warm, uses contractions, perfect for most businesses. (Pidgin is auto-detected by the AI).",
  },
  {
    value: "formal",
    label: "Formal & Professional",
    description: "Strict English, complete sentences, no slang.",
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
    tone: (business.tone as ToneValue) || "friendly",
  };
}

export default function SettingsPage() {
  const [form, setForm] = useState<FormState | null>(null);
  const [, setOwnerEmail] = useState("");
  const [role, setRole] = useState<"OWNER" | "STAFF" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const isOwner = role !== "STAFF";

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/business");
        if (res.status === 401) throw new Error("You need to sign in to view your settings.");
        if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
        
        const data = await res.json();
        if (!active) return;
        setForm(toFormState(data.business));
        setOwnerEmail(data.ownerEmail);
        setRole(data.role === "STAFF" ? "STAFF" : "OWNER");
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Something went wrong");
      }
    }
    load();
    return () => { active = false; };
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

  if (!form && !error) {
    return (
      <div className="space-y-6">
        {[0, 1].map((card) => (
          <div key={card} className="rounded-lg border border-gray-200 bg-surface p-5 sm:p-6">
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

  if (error) {
    return (
      <div role="alert" className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>{error}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* BUSINESS PROFILE */}
      <section className={SECTION_CLASS}>
        <h2 className={HEADING_CLASS}>BUSINESS PROFILE</h2>
        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="business-name" className={LABEL_CLASS}>Business name</label>
            <input id="business-name" value={form?.businessName || ""} onChange={(e) => update("businessName", e.target.value)} className={INPUT_CLASS} />
          </div>
          <div>
            <label htmlFor="business-phone" className={LABEL_CLASS}>Phone number</label>
            <input id="business-phone" value={form?.phone || ""} onChange={(e) => update("phone", e.target.value)} className={INPUT_CLASS} />
          </div>
          <div>
            <label htmlFor="business-hours" className={LABEL_CLASS}>Operating hours</label>
            <input id="business-hours" value={form?.operatingHours || ""} onChange={(e) => update("operatingHours", e.target.value)} className={INPUT_CLASS} placeholder="Mon-Fri 9am-6pm, Sat 10am-4pm" />
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
              <label key={option.value} className={`cursor-pointer rounded-lg border p-4 transition-colors ${selected ? "border-colly bg-[#FFF4EC]" : "border-gray-300 hover:border-gray-400"}`}>
                <span className="flex items-center gap-2">
                  <input type="radio" name="tone" value={option.value} checked={selected} onChange={() => update("tone", option.value)} className="h-4 w-4 accent-colly" />
                  <span className="text-sm font-semibold text-gray-900">{option.label}</span>
                </span>
                <span className="mt-1 block text-xs text-gray-500">{option.description}</span>
              </label>
            );
          })}
        </div>
      </section>

      {/* QUICK LINKS (Team & QR) */}
      <section className={SECTION_CLASS}>
        <h2 className={HEADING_CLASS}>ADVANCED TOOLS</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {isOwner && (
            <Link href="/settings/team" className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 transition-colors hover:border-colly hover:bg-gray-50">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-colly/10 text-colly"><Users className="h-5 w-5" /></div>
              <div>
                <p className="font-medium text-gray-900">Team Members</p>
                <p className="text-xs text-gray-500">Invite staff and manage access</p>
              </div>
            </Link>
          )}
          <Link href="/settings/qr-code" className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 transition-colors hover:border-colly hover:bg-gray-50">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-colly/10 text-colly"><QrCode className="h-5 w-5" /></div>
            <div>
              <p className="font-medium text-gray-900">QR Code Generator</p>
              <p className="text-xs text-gray-500">Print a counter card for your shop</p>
            </div>
          </Link>
        </div>
      </section>

      <div className="flex items-center gap-4">
        <Button type="submit" variant="primary" loading={saving}>Save Changes</Button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm font-medium text-success">
            <CheckCircle2 className="h-4 w-4" /> Saved successfully
          </span>
        )}
      </div>
    </form>
  );
}