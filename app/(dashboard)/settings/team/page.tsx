import { connection } from "next/server";
import type { Metadata } from "next";

import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encodeCursor, LIST_PAGE_SIZE } from "@/lib/pagination";
import { isTeamRole, type TeamMemberView } from "@/lib/team";
import { BackButton } from "@/components/ui/back-button";
import { TeamManager } from "@/components/dashboard/team-manager";

export const metadata: Metadata = {
  title: "Team",
};

/**
 * Team Collaboration settings (owner only).
 *
 * A Server Component so the first paint already has the team list: the page
 * reads the staff rows straight from Prisma and hands them to the client
 * component, which owns the invite form and the remove confirmation. Mutations
 * still go through `/api/team`, which re-checks ownership on every request — the
 * `requireOwner()` below only decides who may *see* the page (and gives a staff
 * session the same bounce the proxy would).
 *
 * `connection()` keeps the page out of the prerender, exactly like the dashboard
 * overview: `requireOwner()` reads the Supabase session, and the rows are
 * per-tenant. `export const dynamic = "force-dynamic"` is not an option here
 * (`cacheComponents: true` rejects it).
 *
 * Only the first page (50) is read; the response carries the keyset cursor so
 * the client can fetch the rest without loading an unbounded team at once.
 */
export default async function TeamSettingsPage() {
  await connection(); // prerendering stops here

  const user = await requireOwner();

  const rows = await prisma.teamMember.findMany({
    where: { businessId: user.businessId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: LIST_PAGE_SIZE,
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  const members: TeamMemberView[] = rows.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    // `role` is a string column; anything unexpected is read as STAFF, the same
    // way lib/auth.ts#loadTeamMember reads it.
    role: isTeamRole(row.role) ? row.role : "STAFF",
    createdAt: row.createdAt.toISOString(),
  }));

  const lastRow = rows.at(-1);
  const nextCursor =
    rows.length === LIST_PAGE_SIZE && lastRow
      ? encodeCursor({ createdAt: lastRow.createdAt, id: lastRow.id })
      : null;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <BackButton />
      <h1 className="font-display text-2xl text-gray-900">Team</h1>
      <p className="mt-1 text-sm text-gray-500">
        Invite the people who work with you. Staff can use the inbox, customers,
        products and invoices — billing and channel settings stay with you.
      </p>

      <TeamManager
        owner={{ email: user.email, name: user.name }}
        initialMembers={members}
        initialNextCursor={nextCursor}
      />
    </div>
  );
}
