import { connection } from "next/server";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TeamManager } from "@/components/dashboard/team-manager";
import { isTeamRole, type TeamMemberView, type TeamOwnerView } from "@/lib/team";

/**
 * /business/team — inline team management.
 *
 * Renders <TeamManager /> directly (no redirect to /settings or /settings/team).
 * Owner only: an invited staff member is bounced to the dashboard before this
 * page renders. Every mutation below still goes through the owner-guarded
 * /api/team route, so this is defence in depth for the render path.
 */
export default async function BusinessTeamPage() {
  await connection();
  const user = await requireOwner();

  const business = await prisma.business.findUnique({
    where: { id: user.businessId },
    select: { name: true },
  });
  if (!business) {
    notFound();
  }

  const teamMembers = await prisma.teamMember.findMany({
    where: { businessId: user.businessId },
    orderBy: [{ createdAt: "desc" }],
  });

  const owner: TeamOwnerView = {
    email: user.email,
    name: user.name ?? null,
  };

  const initialMembers: TeamMemberView[] = teamMembers.map((member) => ({
    id: member.id,
    email: member.email,
    name: member.name,
    role: isTeamRole(member.role) ? member.role : "STAFF",
    createdAt: member.createdAt.toISOString(),
  }));

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="surface-card flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-colly">
            Team & Roles
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold text-main">
            Team
          </h1>
          <p className="mt-1 text-sm text-muted">
            Invite and manage staff who can sign in to this workspace.{" "}
            <span className="font-medium text-main">Owner only.</span>
          </p>
        </div>
        <Link href="/business">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          <span>Business Hub</span>
        </Link>
      </header>

      <TeamManager
        owner={owner}
        initialMembers={initialMembers}
        initialNextCursor={null}
      />
    </div>
  );
}
