import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { JoinTeamForm } from "@/components/auth/join-team-form";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Join your team",
  // An invite link is personal: keep it out of search results.
  robots: { index: false, follow: false },
};

/**
 * Team invitation landing page — the target of the link in the invite email
 * (`lib/team-invite.ts`).
 *
 * `/join/<id>` is session-free (`SESSION_FREE_PATHS` in `lib/public-routes.ts`)
 * because the invitee has no account yet. The id is the `TeamMember` row's
 * cuid: the link stops working the moment the owner removes the row, so
 * removing and re-inviting an address is the way to revoke it.
 *
 * Access is granted by the email match in `lib/auth.ts#loadTenant`, so the page
 * shows the invited address and the form signs up with exactly that address —
 * never one the visitor can type.
 */
export default function JoinTeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // The invite is request data (the `params` promise plus a database read), so
  // it streams inside `<Suspense>`. Awaiting it at the top of the page fails a
  // `cacheComponents` build ("blocking-prerender-dynamic"), the same reason
  // `app/chat/[businessId]/page.tsx` splits its shell from its content.
  return (
    <Suspense fallback={<InviteSkeleton />}>
      <InviteContent params={params} />
    </Suspense>
  );
}

/** The card-shaped placeholder, so the page does not jump when the row lands. */
function InviteSkeleton() {
  return (
    <div
      aria-hidden
      className="h-[360px] animate-pulse rounded-lg border border-gray-200 bg-surface"
    />
  );
}

async function InviteContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const member = id
    ? await prisma.teamMember.findUnique({
        where: { id },
        select: {
          email: true,
          name: true,
          business: { select: { name: true } },
        },
      })
    : null;

  if (!member) {
    return (
      <div className="rounded-lg border border-gray-200 bg-surface p-6 sm:p-8">
        <h1 className="font-display text-2xl text-gray-900">
          This invite is no longer valid
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          The business owner may have removed this team member, or the link was
          cut short. Ask them to invite you again — it only takes a moment.
        </p>
        <p className="mt-6 text-sm text-gray-500">
          <Link
            href="/login?role=business"
            className="font-medium text-colly transition-colors hover:text-colly-hover"
          >
            Go to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <JoinTeamForm
      businessName={member.business.name}
      email={member.email}
      name={member.name}
    />
  );
}
