"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Copy, TriangleAlert, Users } from "lucide-react";
import { useAgentData } from "@/components/agents/use-agent-data";
import type { AgentReferralsResponse } from "@/lib/agents-types";
import { formatRelativeTime } from "@/lib/format";

function subscribeToOrigin(): () => void {
  return () => {};
}

/**
 * The browser origin, or "" during the server render. `useSyncExternalStore`
 * returns the server snapshot for hydration and the client snapshot once
 * mounted, so the link is never read from `window` while it is undefined and
 * no setState-in-effect is needed.
 */
function useOrigin(): string {
  return useSyncExternalStore(
    subscribeToOrigin,
    () => window.location.origin,
    () => "",
  );
}

export default function AgentReferralsPage() {
  const { data, error, loading } = useAgentData<AgentReferralsResponse>(
    "/api/agents/referrals",
  );
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const origin = useOrigin();

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        <div className="h-28 animate-pulse rounded-xl bg-gray-100" />
        <div className="h-64 animate-pulse rounded-xl bg-gray-100" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>{error ?? "We couldn't load your referrals."}</p>
      </div>
    );
  }

  const { agentNumber, referrals } = data;
  const referralLink = origin ? `${origin}/signup?ref=${agentNumber}` : "";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(agentNumber);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be blocked; the ID is shown in full regardless.
    }
  }

  async function handleCopyLink() {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Clipboard access can be blocked; the link is shown in full regardless.
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl text-gray-900">Referrals</h1>
        <p className="mt-1 text-sm text-gray-500">
          Businesses that sign up with your agent ID are credited to you here.
        </p>
      </div>

      {/* Referral link card */}
      <section className="rounded-xl border border-panel-border bg-white p-5">
        <p className="text-[13px] font-medium text-gray-700">
          Your referral link
        </p>
        <p className="mt-1 text-[13px] text-gray-500">
          Share this link with businesses. When they sign up through it, they
          will be credited to you automatically.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="text"
            readOnly
            value={referralLink}
            aria-label="Your referral link"
            placeholder="Loading your link…"
            onFocus={(event) => event.currentTarget.select()}
            className="w-full flex-1 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-[13px] text-gray-700 outline-none"
          />
          <button
            type="button"
            onClick={handleCopyLink}
            disabled={!referralLink}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {linkCopied ? (
              <>
                <Check className="h-3.5 w-3.5 text-success" aria-hidden />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" aria-hidden />
                Copy Link
              </>
            )}
          </button>
        </div>
      </section>

      {/* Agent ID card */}
      <section className="rounded-xl border border-panel-border bg-white p-5">
        <p className="text-[13px] font-medium text-gray-700">Your agent ID</p>
        <p className="mt-1 text-[13px] text-gray-500">
          Ask the business to enter this when they create their Colly account.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <code className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-base font-semibold tracking-wide text-gray-900">
            {agentNumber}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-success" aria-hidden />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" aria-hidden />
                Copy
              </>
            )}
          </button>
        </div>
      </section>

      {/* Referral list */}
      <section>
        {referrals.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white p-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-50 text-gray-400">
              <Users className="h-6 w-6" aria-hidden />
            </div>
            <p className="mt-3 text-sm text-gray-500">
              No referrals yet. Share your agent ID to get started.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-panel-border bg-white">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-[12px] uppercase tracking-wide text-gray-400">
                  <th className="px-4 py-3 font-medium sm:px-5">Business</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((referral) => (
                  <tr
                    key={referral.id}
                    className="border-b border-gray-100 last:border-b-0"
                  >
                    <td className="px-4 py-3 font-medium text-gray-800 sm:px-5">
                      {referral.name}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {formatPlan(referral.plan)}
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {formatRelativeTime(referral.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function formatPlan(plan: string): string {
  if (!plan) return "—";
  return plan.charAt(0).toUpperCase() + plan.slice(1).toLowerCase();
}
