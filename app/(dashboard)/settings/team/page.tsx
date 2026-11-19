import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck, UserPlus, Users } from "lucide-react";
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
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="surface-card flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-colly">
            Team & Roles
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold text-main">
            Team & Roles
          </h1>
          <p className="mt-1 text-sm text-muted">
            Manage team members and access levels for {business.name}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/business"
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-card-ring bg-card-surface px-3.5 py-2 text-sm font-medium text-main transition-all duration-200 hover:border-colly/40 hover:bg-card-surface/80"
          >
            <ArrowLeft className="h-4 w-4" />
            Business Hub
          </Link>
          <Link
            href="/settings"
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-colly px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-colly/90"
          >
            <UserPlus className="h-4 w-4" />
            Invite Member
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/settings"
          className="surface-card surface-panel surface-card-interactive flex items-start gap-3.5 p-5"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-colly/10 text-colly ring-1 ring-colly/15">
            <UserPlus className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-sm font-semibold tracking-wide text-main">
              Invite & Manage Staff
            </h2>
            <p className="mt-1 text-xs text-muted">
              Send invites and configure team access in Settings.
            </p>
          </div>
        </Link>

        <Link
          href="/channels"
          className="surface-card surface-panel surface-card-interactive flex items-start gap-3.5 p-5"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-colly/10 text-colly ring-1 ring-colly/15">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-sm font-semibold tracking-wide text-main">
              Channel & Inbox Access
            </h2>
            <p className="mt-1 text-xs text-muted">
              Review connected channels and shared workspace permissions.
            </p>
          </div>
        </Link>
      </div>

      <section className="surface-card p-5 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-sm font-semibold tracking-wide text-main">
            Current Team Members
          </h2>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-muted">
            <Users className="h-3.5 w-3.5" />
            {teamMembers.length}
          </span>
        </div>

        {teamMembers.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-card-ring p-5 text-sm text-muted">
            No invited team members yet.{" "}
            <Link href="/settings" className="font-medium text-colly hover:underline">
              Add your first team member
            </Link>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-card-ring/60">
            {teamMembers.map((member) => (
              <li
                key={member.id}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-main">
                    {member.name || member.email}
                  </p>
                  {member.name && (
                    <p className="truncate text-xs text-muted">{member.email}</p>
                  )}
                </div>
                <span className="shrink-0 rounded-md border border-card-ring bg-surface-muted px-2.5 py-1 text-xs font-semibold text-main">
                  {member.role}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
