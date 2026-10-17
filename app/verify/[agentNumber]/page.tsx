import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, CircleAlert, ShieldQuestion } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { CourseBadge } from "@/components/agents/course-badge";
import { COURSE_BADGE_SLUGS } from "@/lib/course-badge-meta";

export const metadata: Metadata = {
  title: "Verify a Colly agent",
  description: "Confirm whether an agent is a certified Colly agent.",
};

/**
 * Public certificate verification. Anyone can open /verify/AG-0001 to confirm an
 * agent's certification.
 *
 * The page passes the `params` promise into a Suspense boundary and awaits it in
 * the inner component, per the Cache Components guidance for routes without
 * `generateStaticParams`.
 */
export default function VerifyAgentPage({
  params,
}: {
  params: Promise<{ agentNumber: string }>;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <Image src="/logo.svg" alt="Colly" width={36} height={36} />
          <span className="font-display text-xl tracking-tight text-gray-900">
            Colly
          </span>
        </div>

        <Suspense fallback={<VerifyFallback />}>
          <VerifyDetail params={params} />
        </Suspense>
      </div>
    </div>
  );
}

async function VerifyDetail({
  params,
}: {
  params: Promise<{ agentNumber: string }>;
}) {
  const { agentNumber } = await params;
  const decoded = decodeURIComponent(agentNumber);

  const agent = await prisma.agent.findUnique({
    where: { agentNumber: decoded },
    include: { certificate: true, badges: { select: { courseSlug: true } } },
  });

  const certified = agent !== null && agent.certifiedAt !== null;

  const earnedBadges = new Set(agent?.badges.map((badge) => badge.courseSlug));
  const badges = COURSE_BADGE_SLUGS.map((courseSlug) => ({
    courseSlug,
    earned: earnedBadges.has(courseSlug),
  }));

  return (
    <div className="rounded-lg border border-gray-200 bg-surface p-6 sm:p-8 text-center">
      {!agent && <StatusCard tone="neutral" title="Agent not found"
        body={`We couldn't find an agent with the ID "${decoded}". Check the ID and try again.`}
      />}

      {agent && !certified && (
        <StatusCard
          tone="warning"
          title="Not certified"
          body={`${agent.fullName} (${agent.agentNumber}) is registered but has not completed Colly agent certification yet.`}
        />
      )}

      {agent && certified && agent.certificate && (
        <>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
            <BadgeCheck className="h-7 w-7" aria-hidden />
          </div>
          <h1 className="mt-4 font-display text-2xl text-gray-900">
            Verified Colly agent
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            This agent is certified to set up and configure Colly.
          </p>

          <dl className="mt-6 divide-y divide-gray-100 rounded-lg border border-gray-200 text-left">
            <Row label="Name" value={agent.fullName} />
            <Row label="Agent ID" value={agent.agentNumber} />
            <Row label="Certificate ID" value={agent.certificate.certificateId} />
            <Row
              label="Certified on"
              value={agent.certificate.issuedAt.toLocaleDateString("en-NG", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            />
            {agent.state && <Row label="State" value={agent.state} />}
            {agent.finalExamPassedAt && (
              <Row
                label="Final exam passed"
                value={agent.finalExamPassedAt.toLocaleDateString("en-NG", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              />
            )}
          </dl>
        </>
      )}

      {agent && (
        <div className="mt-6">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.15em] text-gray-400">
            Course badges
          </p>
          <div className="grid grid-cols-4 gap-3">
            {badges.map((badge) => (
              <Link
                key={badge.courseSlug}
                href={`/verify/${agent.agentNumber}/${badge.courseSlug}`}
                aria-label={`View ${badge.courseSlug} badge detail`}
                className="inline-flex justify-center rounded-lg transition-opacity hover:opacity-80"
              >
                <CourseBadge
                  courseSlug={badge.courseSlug}
                  earned={badge.earned}
                  size="sm"
                />
              </Link>
            ))}
          </div>
        </div>
      )}

      <p className="mt-6 text-sm text-gray-500">
        <Link
          href="/"
          className="font-medium text-colly transition-colors hover:text-colly-hover"
        >
          Go to Colly
        </Link>
      </p>
    </div>
  );
}

function StatusCard({
  tone,
  title,
  body,
}: {
  tone: "neutral" | "warning";
  title: string;
  body: string;
}) {
  const Icon = tone === "warning" ? CircleAlert : ShieldQuestion;
  const iconClass =
    tone === "warning" ? "bg-amber-50 text-amber-600" : "bg-gray-100 text-gray-500";

  return (
    <>
      <div
        className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${iconClass}`}
      >
        <Icon className="h-7 w-7" aria-hidden />
      </div>
      <h1 className="mt-4 font-display text-2xl text-gray-900">{title}</h1>
      <p className="mt-1 text-sm text-gray-500">{body}</p>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <dt className="text-[13px] text-gray-500">{label}</dt>
      <dd className="text-[13px] font-medium text-gray-800">{value}</dd>
    </div>
  );
}

function VerifyFallback() {
  return (
    <div className="rounded-lg border border-gray-200 bg-surface p-6 sm:p-8">
      <div className="mx-auto h-14 w-14 animate-pulse rounded-full bg-gray-100" />
      <div className="mx-auto mt-4 h-6 w-48 animate-pulse rounded bg-gray-100" />
      <div className="mx-auto mt-3 h-4 w-64 animate-pulse rounded bg-gray-100" />
    </div>
  );
}
