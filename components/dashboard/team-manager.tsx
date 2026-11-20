"use client";

import { useState, FormEvent } from "react";
import { ShieldCheck, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import {
  TEAM_MEMBER_NAME_MAX,
  isTeamRole,
  type TeamMemberView,
  type TeamOwnerView,
} from "@/lib/team";

type TeamManagerProps = {
  owner: TeamOwnerView;
  /** First page of staff rows, read on the server by the settings page. */
  initialMembers: TeamMemberView[];
  /** Keyset cursor for the next page, or null when the whole team fit. */
  initialNextCursor: string | null;
};

const LABEL_CLASS = "mb-1 block text-sm font-medium text-main";
const INPUT_CLASS =
  "w-full rounded-xl border border-card-ring bg-card-surface px-3 py-2 text-sm text-main outline-none transition-all duration-250 placeholder:text-muted focus:border-colly focus:ring-2 focus:ring-colly/20";
const AVATAR_CLASS =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-semibold text-muted";

/** Pulls a human error message out of an untrusted JSON body. */
function errorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const message = (payload as { error?: unknown }).error;
  return typeof message === "string" && message.trim() ? message : null;
}

/**
 * Reads the `members` array of a `/api/team` response, dropping any row that
 * does not look like a team member — the client never trusts the shape.
 */
function readMembers(payload: unknown): TeamMemberView[] {
  if (!payload || typeof payload !== "object") return [];
  const rows = (payload as { members?: unknown }).members;
  if (!Array.isArray(rows)) return [];

  return rows.flatMap((row): TeamMemberView[] => {
    if (!row || typeof row !== "object") return [];
    const value = row as Record<string, unknown>;
    if (typeof value.id !== "string" || typeof value.email !== "string") {
      return [];
    }
    return [
      {
        id: value.id,
        email: value.email,
        name:
          typeof value.name === "string" && value.name
            ? value.name
            : value.email,
        role: isTeamRole(value.role) ? value.role : "STAFF",
        createdAt: typeof value.createdAt === "string" ? value.createdAt : "",
      },
    ];
  });
}

function readNextCursor(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const cursor = (payload as { nextCursor?: unknown }).nextCursor;
  return typeof cursor === "string" && cursor ? cursor : null;
}

/** What `POST /api/team` reports about the invitation email. */
type InviteDelivery = {
  /** True when the provider accepted the message. */
  emailed: boolean;
  /** The `/join/<id>` link — the manual fallback when mail fails. */
  link: string;
};

/**
 * Reads the `invite` block of a `POST /api/team` response.
 *
 * The row is saved whether or not the mail went out, so this is only used to
 * word the confirmation and to offer the "copy the link yourself" fallback. A
 * malformed block is dropped rather than trusted.
 */
function readInviteDelivery(payload: unknown): InviteDelivery | null {
  if (!payload || typeof payload !== "object") return null;
  const invite = (payload as { invite?: unknown }).invite;
  if (!invite || typeof invite !== "object") return null;

  const value = invite as Record<string, unknown>;
  if (typeof value.link !== "string" || !/^https?:\/\//i.test(value.link)) {
    return null;
  }

  return { emailed: value.emailed === true, link: value.link };
}

/** Two-letter avatar label: "Ada Obi" -> "AO", "ada@shop.ng" -> "AD". */
function initials(name: string, email: string): string {
  const source = (name || email).trim();
  if (!source) return "?";

  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

/** "Invited 3 Nov 2026", or "" when the stamp is missing/invalid. */
function formatInvited(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  return `Invited ${date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;
}

function RoleBadge({ role }: { role: "OWNER" | "STAFF" }) {
  const owner = role === "OWNER";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        owner ? "bg-colly-tint text-[#FF6600]" : "bg-surface-muted text-muted"
      }`}
    >
      {owner && <ShieldCheck className="h-3 w-3" aria-hidden />}
      {owner ? "Owner" : "Staff"}
    </span>
  );
}

/**
 * Team Collaboration manager (owner only).
 *
 * The settings page has already read the first page of staff on the server, so
 * this component starts with real data and only calls `/api/team` when
 * something changes (invite, remove, next page). Every request is re-authorised
 * server-side: keeping these controls away from staff is convenience, not
 * security.
 */

/**
 * Status badge: ACTIVE for staff/owner, PENDING for pending invite. */
function StatusBadge({
  role,
}: {
  role: TeamMemberView["role"];
}) {
  const active = role === "OWNER" || role === "STAFF";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${active ? "bg-colly/10 text-colly" : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"}`}
    >
      {active ? "Active" : "Pending"}
    </span>
  );
}
export function TeamManager({
  owner,
  initialMembers,
  initialNextCursor,
}: TeamManagerProps) {
  const [members, setMembers] = useState<TeamMemberView[]>(initialMembers);
  const [nextCursor, setNextCursor] = useState<string | null>(
    initialNextCursor,
  );

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [inviting, setInviting] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  /** Result of the last invite, shown under the form (and its link copied). */
  const [lastInvite, setLastInvite] = useState<InviteDelivery | null>(null);

  const [pendingRemoval, setPendingRemoval] =
    useState<TeamMemberView | null>(null);
  const [removing, setRemoving] = useState(false);

  /** A role dropdown is being submitted, to block double-clicks. */
  const [roleUpdating, setRoleUpdating] = useState<{
    id: string;
    role: "OWNER" | "STAFF";
  } | null>(null);

  /** Re-reads the first page; used after an invite or a removal. */
  async function refresh() {
    const res = await fetch("/api/team", { cache: "no-store" });
    const payload: unknown = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(errorMessage(payload) ?? "Could not reload your team");
    }

    setMembers(readMembers(payload));
    setNextCursor(readNextCursor(payload));
  }

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      toast.error("Enter the email address you want to invite.");
      return;
    }

    setInviting(true);
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, name: name.trim() }),
      });
      const payload: unknown = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(errorMessage(payload) ?? "Could not save that invite");
      }

      // The row is saved either way; `invite.emailed` only says whether the
      // notification left the building.
      const delivery = readInviteDelivery(payload);
      setLastInvite(delivery);

      if (delivery?.emailed) {
        toast.success(`Invite emailed to ${trimmedEmail}`);
      } else {
        toast.warning(
          delivery
            ? `Invite saved for ${trimmedEmail}, but the email did not go out. Copy the link below and send it yourself.`
            : `Invite saved for ${trimmedEmail}`,
        );
      }

      setEmail("");
      setName("");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setInviting(false);
    }
  }

  /** Copies the `/join/<id>` link when the email could not be delivered. */
  async function copyInviteLink() {
    if (!lastInvite) return;

    try {
      await navigator.clipboard.writeText(lastInvite.link);
      toast.success("Invite link copied");
    } catch {
      toast.error("Could not copy the link. Select it and copy by hand.");
    }
  }

  /** Fetches the next keyset page and appends it, skipping duplicates. */
  async function loadMore() {
    if (!nextCursor || loadingMore) return;

    setLoadingMore(true);
    try {
      const res = await fetch(
        `/api/team?cursor=${encodeURIComponent(nextCursor)}`,
        { cache: "no-store" },
      );
      const payload: unknown = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          errorMessage(payload) ?? "Could not load more team members",
        );
      }

      const extra = readMembers(payload);
      setMembers((current) => {
        const seen = new Set(current.map((member) => member.id));
        return [...current, ...extra.filter((member) => !seen.has(member.id))];
      });
      setNextCursor(readNextCursor(payload));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoadingMore(false);
    }
  }

  async function confirmRemoval() {
    const target = pendingRemoval;
    if (!target || removing) return;

    setRemoving(true);
    try {
      const res = await fetch(
        `/api/team?id=${encodeURIComponent(target.id)}`,
        { method: "DELETE" },
      );
      const payload: unknown = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          errorMessage(payload) ?? "Could not remove that team member",
        );
      }

      setPendingRemoval(null);
      toast.success(`${target.name || target.email} no longer has access`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setRemoving(false);
    }
  }
async function handleRoleChange(
     memberId: string,
     newRole: "OWNER" | "STAFF",
   ) {
     setRoleUpdating({ id: memberId, role: newRole });
     try {
       const res = await fetch("/api/team", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ role: newRole, memberId }),
       });
       const payload: unknown = await res.json().catch(() => null);
       if (!res.ok) {
         throw new Error(errorMessage(payload) ?? "Could not update role");
       }
       await refresh();
     } catch (err) {
       toast.error(err instanceof Error ? err.message : "Something went wrong");
     } finally {
       setRoleUpdating(null);
     }
   }

  const ownerName = owner.name?.trim() || "Business owner";
  const staffLabel =
    members.length === 0
      ? "No staff yet"
      : `${members.length}${nextCursor ? "+" : ""} ${
          members.length === 1 ? "person" : "people"
        }`;

  return (
    <div className="mt-6 space-y-6">
      <Card>
        <CardHeader
          title="Invite a team member"
          subtitle="Staff work inside your dashboard with your products, customers and inbox. Billing, channel setup and team changes stay with you."
        />

        <form onSubmit={handleInvite} className="mt-4 space-y-4">
          <div>
            <label htmlFor="team-email" className={LABEL_CLASS}>
              Email address
            </label>
            <input
              id="team-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="teammate@example.com"
              className={INPUT_CLASS}
            />
          </div>

          <div>
            <label htmlFor="team-name" className={LABEL_CLASS}>
              Name{" "}
              <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id="team-name"
              value={name}
              maxLength={TEAM_MEMBER_NAME_MAX}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ada"
              className={INPUT_CLASS}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="primary" isLoading={inviting}>
              Send invite
            </Button>
            <p className="text-xs text-muted">
              We email them an invite link. They open it, set a password and land
              in your dashboard as staff — they must sign up with the address you
              type here.
            </p>
          </div>
        </form>

        {lastInvite && (
          <div
            role="status"
            className={`mt-4 rounded-xl border p-4 text-sm ${
              lastInvite.emailed
                ? "border-success/30 bg-success/5 text-main"
                : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
            }`}
          >
            <p>
              {lastInvite.emailed
                ? "Invitation emailed. They open the link, choose a password and they are in."
                : "The invitation was saved, but we could not send the email. Copy this link and send it to them yourself."}
            </p>
            <p className="mt-2 break-all text-xs text-muted">
              {lastInvite.link}
            </p>
            {!lastInvite.emailed && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={copyInviteLink}
              >
                Copy invite link
              </Button>
            )}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Your team"
          subtitle="Everyone who can sign in to this workspace."
          action={
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
              <Users className="h-4 w-4" aria-hidden />
              {staffLabel}
            </span>
          }
        />

        <ul className="mt-4 divide-y divide-card-border">
          {/* The owner is a User row, never a TeamMember — it cannot be removed. */}
          <li className="flex items-center gap-3 py-3">
            <span className={AVATAR_CLASS} aria-hidden>
              {initials(ownerName, owner.email)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-main">
                {ownerName}{" "}
                <span className="font-normal text-muted">(you)</span>
              </p>
              <p className="truncate text-xs text-muted">{owner.email}</p>
            </div>
            <RoleBadge role="OWNER" />
          </li>

          {members.map((member) => (
            <li key={member.id} className="flex items-center gap-3 py-3">
              <span className={AVATAR_CLASS} aria-hidden>
                {initials(member.name, member.email)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-main">
                  {member.name || member.email}
                </p>
                <p className="truncate text-xs text-muted">
                  {member.email}
                  {formatInvited(member.createdAt) && (
                    <span className="text-muted">
                      {" "}
                      · {formatInvited(member.createdAt)}
                    </span>
                  )}
                </p>
              </div>
              <StatusBadge role={member.role} />
              <RoleBadge role="STAFF" />
              <select
                defaultValue={member.role}
                onChange={(e) => handleRoleChange(member.id, e.target.value as "OWNER" | "STAFF")}
                disabled={roleUpdating?.id === member.id}
                className="ml-2 rounded-xl border border-card-ring bg-card-surface px-2 py-1 text-sm text-main outline-none focus:border-colly focus:ring-2 focus:ring-colly/20"
              >
                <option value="STAFF">Staff</option>
                <option value="OWNER">Owner</option>
              </select>
              <button
                type="button"
                onClick={() => setPendingRemoval(member)}
                aria-label={`Remove ${member.name || member.email}`}
                title="Remove access"
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-muted transition-all duration-250 hover:bg-red-50 hover:text-red-600 active:scale-[0.94] dark:hover:bg-red-950/40 focus:outline-none focus:ring-4 focus:ring-red-500/20"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>

        {members.length === 0 && (
          <p className="surface-panel mt-2 p-4 text-sm text-muted">
            No one else is on your team yet. Invite a staff member above and
            they will appear here.
          </p>
        )}

        {nextCursor && (
          <div className="mt-4">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              isLoading={loadingMore}
              onClick={loadMore}
            >
              Show more
            </Button>
          </div>
        )}
      </Card>

      {pendingRemoval && (
        <Modal
          title="Remove team member"
          onClose={() => {
            if (!removing) setPendingRemoval(null);
          }}
          footer={
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPendingRemoval(null)}
                disabled={removing}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                isLoading={removing}
                onClick={confirmRemoval}
              >
                Remove
              </Button>
            </div>
          }
        >
          <p className="text-sm text-muted">
            <strong className="font-semibold text-main">
              {pendingRemoval.name || pendingRemoval.email}
            </strong>{" "}
            will lose access to your dashboard on their next request. Their
            account is not deleted — you can invite the same address again later.
          </p>
          <p className="mt-3 text-xs text-muted">{pendingRemoval.email}</p>
        </Modal>
      )}
    </div>
  );
}
