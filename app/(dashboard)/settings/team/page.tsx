import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function TeamPage() {
  await connection();
  const user = await requireOwner();

  const business = await prisma.business.findUnique({
    where: { id: user.businessId },
  });
  if (!business) {
    notFound();
  }

  const teamMembers = await prisma.teamMember.findMany({
    where: { businessId: user.businessId },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <header className="surface-card p-5 sm:p-6">
        <h1 className="font-display text-base tracking-wide text-main">
          Team & Roles
        </h1>
        <p className="mt-1 text-sm text-muted">
          Manage team members and their access levels for {business.name}
        </p>
      </header>

      <div className="surface-card p-5 sm:p-6">
        <h2 className="font-display text-sm tracking-wide text-main mb-2">
          Invite team members
        </h2>
        <p className="text-sm text-muted mb-4">
          Manage invitations and team settings in Settings.
        </p>
        <Link
          href="/settings"
          className="inline-block text-sm font-medium text-colly hover:underline"
        >
          Go to Settings
        </Link>
      </div>

      <div className="surface-card p-5 sm:p-6">
        <h2 className="font-display text-sm tracking-wide text-main mb-4">
          Current team members
        </h2>
        {teamMembers.length === 0 ? (
          <p className="text-sm text-muted">
            No team members yet.{" "}
            <Link href="/settings" className="text-colly hover:underline">
              Add your first team member
            </Link>
          </p>
        ) : (
          <ul className="space-y-2 text-sm text-main">
            {teamMembers.map((member) => (
              <li key={member.id} className="flex items-center gap-3">
                <span className="font-medium">{member.name || member.email}</span>
                <span className="text-xs text-muted">{member.role}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
