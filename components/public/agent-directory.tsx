"use client";

import { useState } from "react";
import { BadgeCheck, MapPin, MessageCircle } from "lucide-react";
import { NIGERIAN_STATES } from "@/lib/nigerian-states";

/**
 * The public projection of an Agent row. Deliberately excludes `email` and
 * `supabaseUserId` -- the directory must never expose them.
 */
export type DirectoryAgent = {
  fullName: string;
  agentNumber: string;
  phone: string | null;
  state: string | null;
};

/**
 * The number in wa.me's international format: non-digits are dropped, a
 * Nigerian local number ("08012345678") gains the country code, and an already
 * international number ("+2348012345678" / "2348012345678") is kept as-is.
 */
function waNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("234")) return digits;
  if (digits.startsWith("0")) return `234${digits.slice(1)}`;
  return digits;
}

function waLink(agent: DirectoryAgent): string | null {
  if (!agent.phone) return null;
  const number = waNumber(agent.phone);
  if (!number) return null;
  const text = `Hi%20${encodeURIComponent(
    agent.fullName,
  )},%20I%20found%20you%20on%20Colly%20and%20I%20need%20help%20setting%20up%20my%20business.`;
  return `https://wa.me/${number}?text=${text}`;
}

/**
 * The certified agent directory: a state filter over a grid of agent cards.
 * Client-side only -- the agent list is fetched once on the server and passed
 * in as plain serialisable data.
 */
export function AgentDirectory({ agents }: { agents: DirectoryAgent[] }) {
  const [selectedState, setSelectedState] = useState("");

  // Every Nigerian state, plus any state stored on an agent that is not in the
  // list, so a stored value can never become unfilterable.
  const stateOptions = Array.from(
    new Set<string>([
      ...NIGERIAN_STATES,
      ...agents
        .map((agent) => agent.state)
        .filter((state): state is string => Boolean(state)),
    ]),
  ).sort((a, b) => a.localeCompare(b));

  const visible = selectedState
    ? agents.filter((agent) => agent.state === selectedState)
    : agents;

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center gap-3">
        <label
          htmlFor="agent-state-filter"
          className="text-sm font-medium text-gray-700"
        >
          State
        </label>
        <select
          id="agent-state-filter"
          value={selectedState}
          onChange={(event) => setSelectedState(event.target.value)}
          className="w-full max-w-xs rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-colly focus:ring-2 focus:ring-colly/20 sm:w-56"
        >
          <option value="">All states</option>
          {stateOptions.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </select>
        <span className="text-[13px] text-gray-500">
          {visible.length} {visible.length === 1 ? "agent" : "agents"}
        </span>
      </div>

      {visible.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-gray-200 bg-surface px-4 py-12 text-center text-sm text-gray-500">
          No certified agents in this state yet. Check back soon!
        </p>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visible.map((agent) => {
            const link = waLink(agent);
            return (
              <li
                key={agent.agentNumber}
                className="flex flex-col rounded-xl border border-gray-200 bg-surface p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-gray-900">
                      {agent.fullName}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
                      <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                      {agent.state || "Nigeria"}
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success">
                    <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                    Certified
                  </span>
                </div>

                <dl className="mt-5">
                  <dt className="text-[11px] font-medium uppercase tracking-[0.15em] text-gray-400">
                    Agent ID
                  </dt>
                  <dd className="mt-0.5 font-mono text-sm font-semibold text-gray-700">
                    {agent.agentNumber}
                  </dd>
                </dl>

                {link && (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1ebe5b]"
                  >
                    <MessageCircle className="h-4 w-4" aria-hidden />
                    Contact on WhatsApp
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
