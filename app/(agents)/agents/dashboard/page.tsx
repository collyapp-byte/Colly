"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Award,
  BookOpen,
  ChevronDown,
  Download,
  Share2,
  TriangleAlert,
} from "lucide-react";
import { useAgentData } from "@/components/agents/use-agent-data";
import { CourseBadge } from "@/components/agents/course-badge";
import type { AgentBadgesResponse, AgentMeResponse } from "@/lib/agents-types";
import { formatRelativeTime } from "@/lib/format";

export default function AgentDashboardPage() {
  const { data, error, loading } = useAgentData<AgentMeResponse>(
    "/api/agents/me",
  );
  const { data: badgesData } = useAgentData<AgentBadgesResponse>(
    "/api/agents/badges",
  );
  const [copied, setCopied] = useState(false);
  // Which badge's Download menu is open (by course slug), and which badge's
  // share link was just copied (drives the "Copied!" tooltip).
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the open download menu on click outside or Escape, matching the
  // sidebar switcher pattern.
  useEffect(() => {
    if (!menuOpen) return;

    function handleMouseDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(null);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(null);
    }

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  if (loading) return <DashboardSkeleton />;

  if (error || !data) {
    return <StateMessage message={error ?? "We couldn't load your dashboard."} />;
  }

  const { agent, progress, certified, referrals } = data;

  async function handleCopyShareLink() {
    const url = `${window.location.origin}/verify/${agent.agentNumber}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be blocked; fall back to a prompt so the agent can
      // still copy the link manually.
      window.prompt("Copy this link:", url);
    }
  }

  /** Copies this agent's per-badge verification link for a course. */
  async function copyShareLink(courseSlug: string) {
    const url = `${window.location.origin}/verify/${agent.agentNumber}/${courseSlug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedSlug(courseSlug);
      window.setTimeout(() => {
        setCopiedSlug((current) => (current === courseSlug ? null : current));
      }, 2000);
    } catch {
      // Clipboard access can be blocked; fall back to a prompt.
      window.prompt("Copy this link:", url);
    }
  }

  const percent =
    progress.totalLessons > 0
      ? Math.round((progress.completedLessons / progress.totalLessons) * 100)
      : 0;
  const earnedBadgeCount = badgesData
    ? badgesData.badges.filter((badge) => badge.earned).length
    : 0;
  const totalBadges = badgesData?.badges.length ?? 4;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl text-gray-900">
          Welcome, {agent.fullName.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Your agent ID is <span className="font-medium text-gray-700">{agent.agentNumber}</span>.
          Share it with businesses so they can credit you at signup.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {/* Training progress */}
        <section className="rounded-xl border border-[color:var(--outline-subtle)] bg-white p-5 md:col-span-2">
          <div className="flex items-center gap-2 text-gray-500">
            <BookOpen className="h-4 w-4" aria-hidden />
            <span className="text-[13px] font-medium">Training progress</span>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-x-10 gap-y-3">
            <p className="text-3xl font-semibold text-gray-900">
              {progress.completedLessons}
              <span className="text-lg font-normal text-gray-400">
                {" "}
                / {progress.totalLessons} lessons
              </span>
            </p>
            {badgesData && (
              <p className="text-3xl font-semibold text-gray-900">
                {earnedBadgeCount}
                <span className="text-lg font-normal text-gray-400">
                  {" "}
                  / {totalBadges} badges earned
                </span>
              </p>
            )}
          </div>

          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-colly transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>

          <div className="mt-5">
            <Link
              href="/agents/training"
              className="inline-flex items-center justify-center rounded-lg bg-[#FF6600] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#E65C00]"
            >
              {percent === 100 ? "Review training" : "Continue training"}
            </Link>
          </div>
        </section>

        {/* Certification */}
        <section className="rounded-xl border border-[color:var(--outline-subtle)] bg-white p-5">
          <div className="flex items-center gap-2 text-gray-500">
            <Award className="h-4 w-4" aria-hidden />
            <span className="text-[13px] font-medium">Certification</span>
          </div>

          {certified ? (
            <>
              <p className="mt-4 text-lg font-semibold text-success">
                Certified
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Well done. Your certificate is ready to download and share.
              </p>
              <Link
                href="/agents/certificate"
                className="mt-5 inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                View certificate
              </Link>
            </>
          ) : badgesData?.allEarned ? (
            <>
              <p className="mt-4 text-lg font-semibold text-amber-700">
                Eligible for Final Exam
              </p>
              <p className="mt-1 text-sm text-gray-500">
                You have earned all four badges. Take the final exam to get certified.
              </p>
            </>
          ) : (
            <>
              <p className="mt-4 text-lg font-semibold text-amber-700">
                In training
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Finish every course and earn all badges to unlock the final exam.
              </p>
            </>
          )}
        </section>
      </div>

      {/* Course badges */}
      {badgesData && (
        <section className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">
              Course badges
            </h3>
            <button
              type="button"
              onClick={handleCopyShareLink}
              className="text-xs text-gray-500 transition-colors hover:text-colly"
            >
              {copied ? "Link copied!" : "Copy share link"}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {badgesData.badges.map((badge) => (
              <div
                key={badge.courseSlug}
                className="flex flex-col items-center gap-2"
              >
                <CourseBadge
                  courseSlug={badge.courseSlug}
                  earned={badge.earned}
                  size="md"
                />
                <p className="text-xs text-gray-500">
                  {badge.earned && badge.earnedAt
                    ? formatRelativeTime(badge.earnedAt)
                    : "Not yet earned"}
                </p>
                {badge.earned && (
                  <div
                    ref={menuOpen === badge.courseSlug ? menuRef : undefined}
                    className="relative flex items-center gap-1"
                  >
                    <button
                      type="button"
                      aria-haspopup="menu"
                      aria-expanded={menuOpen === badge.courseSlug}
                      onClick={() =>
                        setMenuOpen((open) =>
                          open === badge.courseSlug ? null : badge.courseSlug,
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-gray-600 transition-colors hover:bg-gray-50"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden />
                      Download
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform duration-150 ${
                          menuOpen === badge.courseSlug ? "rotate-180" : ""
                        }`}
                        aria-hidden
                      />
                    </button>

                    <span className="relative">
                      <button
                        type="button"
                        onClick={() => copyShareLink(badge.courseSlug)}
                        title="Copy share link"
                        aria-label="Copy share link"
                        className="inline-flex items-center rounded-md p-1 text-gray-600 transition-colors hover:bg-gray-50"
                      >
                        <Share2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      {copiedSlug === badge.courseSlug && (
                        <span className="absolute bottom-[calc(100%+4px)] left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-0.5 text-[10px] font-medium text-white">
                          Copied!
                        </span>
                      )}
                    </span>

                    {menuOpen === badge.courseSlug && (
                      <div
                        role="menu"
                        className="absolute left-1/2 top-[calc(100%+4px)] z-50 w-36 -translate-x-1/2 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
                      >
                        <a
                          role="menuitem"
                          href={`/api/agents/badges/${badge.courseSlug}/png`}
                          onClick={() => setMenuOpen(null)}
                          className="block px-3 py-2 text-xs text-gray-700 transition-colors hover:bg-gray-50"
                        >
                          Download PNG
                        </a>
                        <a
                          role="menuitem"
                          href={`/api/agents/badges/${badge.courseSlug}/svg`}
                          onClick={() => setMenuOpen(null)}
                          className="block px-3 py-2 text-xs text-gray-700 transition-colors hover:bg-gray-50"
                        >
                          Download SVG
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          {badgesData?.allEarned && (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-sm text-green-800">
                {certified
                  ? "🎉 Final exam passed. You are certified."
                  : "🎉 All 4 badges earned! Take the final certification exam."}
              </p>
              {certified ? (
                <Link
                  href="/agents/certificate"
                  className="mt-2 inline-flex items-center rounded-lg bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-800"
                >
                  View certificate
                </Link>
              ) : (
                <Link
                  href="/agents/final-exam"
                  className="mt-2 inline-flex items-center rounded-lg bg-[#FF6600] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#E65C00]"
                >
                  Start Final Certification Exam
                </Link>
              )}
            </div>
          )}
        </section>
      )}

      {/* Referrals */}
      <section className="rounded-xl border border-[color:var(--outline-subtle)] bg-white p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-500">
            <Share2 className="h-4 w-4" aria-hidden />
            <span className="text-[13px] font-medium">
              Businesses you referred
            </span>
          </div>
          <Link
            href="/agents/referrals"
            className="text-[13px] font-medium text-colly transition-colors hover:text-colly-hover"
          >
            View all
          </Link>
        </div>

        {referrals.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">
            No referrals yet. Businesses that enter your agent ID when they sign up
            will appear here.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-gray-100">
            {referrals.slice(0, 5).map((referral) => (
              <li
                key={referral.id}
                className="flex items-center justify-between py-2.5"
              >
                <span className="text-sm font-medium text-gray-800">
                  {referral.name}
                </span>
                <span className="text-[13px] text-gray-400">
                  {formatRelativeTime(referral.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="h-7 w-56 animate-pulse rounded bg-gray-200" />
      <div className="grid gap-5 md:grid-cols-3">
        <div className="h-44 animate-pulse rounded-xl bg-gray-100 md:col-span-2" />
        <div className="h-44 animate-pulse rounded-xl bg-gray-100" />
      </div>
      <div className="h-32 animate-pulse rounded-xl bg-gray-100" />
    </div>
  );
}

function StateMessage({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p>{message}</p>
    </div>
  );
}
