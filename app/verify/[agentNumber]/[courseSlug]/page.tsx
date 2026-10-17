import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { CircleAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { CourseBadge } from "@/components/agents/course-badge";
import { COURSE_BADGES, isCourseSlug } from "@/lib/course-badge-meta";

export const metadata: Metadata = {
  title: "Verify a Colly badge",
  description: "Confirm whether a Colly agent has earned a specific course badge.",
};

/**
 * Public per-badge verification. Anyone can open
 * /verify/AG-0001/understanding-colly to confirm a single course badge and, when
 * earned, add it to a LinkedIn profile.
 *
 * The `params` promise is awaited inside a Suspense boundary, per the Cache
 * Components guidance for routes without `generateStaticParams`.
 */
export default function VerifyBadgePage({
  params,
}: {
  params: Promise<{ agentNumber: string; courseSlug: string }>;
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

        <Suspense fallback={<BadgeFallback />}>
          <BadgeDetail params={params} />
        </Suspense>
      </div>
    </div>
  );
}

async function BadgeDetail({
  params,
}: {
  params: Promise<{ agentNumber: string; courseSlug: string }>;
}) {
  const { agentNumber, courseSlug } = await params;
  const decodedAgent = decodeURIComponent(agentNumber);
  const decodedSlug = decodeURIComponent(courseSlug);

  if (!isCourseSlug(decodedSlug)) {
    return (
      <StatusCard
        title="Badge not found"
        body={`"${decodedSlug}" is not a Colly course badge.`}
      />
    );
  }

  const agent = await prisma.agent.findUnique({
    where: { agentNumber: decodedAgent },
    include: { badges: { where: { courseSlug: decodedSlug } } },
  });

  if (!agent) {
    return (
      <StatusCard
        title="Agent not found"
        body={`We couldn't find an agent with the ID "${decodedAgent}".`}
      />
    );
  }

  const badge = agent.badges[0] ?? null;
  const earned = badge !== null;
  const courseName = COURSE_BADGES[decodedSlug].label;

  // Build a self-referential URL for sharing (LinkedIn certUrl + printed label).
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "colly.com.ng";
  const proto = requestHeaders.get("x-forwarded-proto") ?? "https";
  const verifyUrl = `${proto}://${host}/verify/${agent.agentNumber}/${decodedSlug}`;
  const verifyUrlLabel = verifyUrl.replace(/^https?:\/\//, "");

  const issuedDate = badge
    ? badge.earnedAt.toLocaleDateString("en-NG", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const linkedInHref = badge
    ? linkedInAddUrl({
        courseName,
        verifyUrl,
        certId: `${agent.agentNumber}-${decodedSlug}-${badge.earnedAt.getFullYear()}`,
        year: badge.earnedAt.getFullYear(),
        month: badge.earnedAt.getMonth() + 1,
      })
    : null;

  return (
    <div className="rounded-lg border border-gray-200 bg-surface p-6 text-center sm:p-8">
      <div className="flex justify-center">
        <CourseBadge courseSlug={decodedSlug} earned={earned} size="lg" />
      </div>

      {earned ? (
        <>
          <h1 className="mt-5 font-display text-2xl tracking-[0.15em] text-gray-900">
            CERTIFIED
          </h1>
          <p className="mt-1 text-base font-medium text-gray-700">
            {courseName}
          </p>
        </>
      ) : (
        <>
          <h1 className="mt-5 font-display text-xl text-gray-900">
            Badge not earned
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            This agent has not earned this badge yet.
          </p>
        </>
      )}

      <dl className="mt-6 divide-y divide-gray-100 rounded-lg border border-gray-200 text-left">
        <Row label="Earner" value={agent.fullName} />
        <Row label="Agent ID" value={agent.agentNumber} />
        {earned && issuedDate && <Row label="Issued" value={issuedDate} />}
      </dl>

      <p className="mt-5 break-all text-[12px] text-gray-400">
        Verify at {verifyUrlLabel}
      </p>

      {linkedInHref && (
        <a
          href={linkedInHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-[#0A66C2] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#004182]"
        >
          <LinkedInGlyph className="h-4 w-4" />
          Add to LinkedIn profile
        </a>
      )}

      <p className="mt-6 text-sm text-gray-500">
        <Link
          href={`/verify/${agent.agentNumber}`}
          className="font-medium text-colly transition-colors hover:text-colly-hover"
        >
          View all badges
        </Link>
      </p>
    </div>
  );
}

/** Builds a LinkedIn "Add to profile" deep link for a certification. */
function linkedInAddUrl({
  courseName,
  verifyUrl,
  certId,
  year,
  month,
}: {
  courseName: string;
  verifyUrl: string;
  certId: string;
  year: number;
  month: number;
}): string {
  const query = new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: courseName,
    organizationName: "Colly",
    issueYear: String(year),
    issueMonth: String(month),
    certUrl: verifyUrl,
    certId,
  });
  return `https://www.linkedin.com/profile/add?${query.toString()}`;
}

/**
 * LinkedIn brand glyph. The installed lucide-react no longer ships brand icons
 * (there is no `Linkedin` export), so the mark is inlined. Rendered with
 * `currentColor` so it inherits the button's white text colour.
 */
function LinkedInGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z" />
    </svg>
  );
}

function StatusCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-surface p-6 text-center sm:p-8">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-500">
        <CircleAlert className="h-7 w-7" aria-hidden />
      </div>
      <h1 className="mt-4 font-display text-2xl text-gray-900">{title}</h1>
      <p className="mt-1 text-sm text-gray-500">{body}</p>
    </div>
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

function BadgeFallback() {
  return (
    <div className="rounded-lg border border-gray-200 bg-surface p-6 sm:p-8">
      <div className="mx-auto h-32 w-32 animate-pulse rounded-full bg-gray-100" />
      <div className="mx-auto mt-4 h-6 w-40 animate-pulse rounded bg-gray-100" />
      <div className="mx-auto mt-3 h-4 w-52 animate-pulse rounded bg-gray-100" />
    </div>
  );
}
