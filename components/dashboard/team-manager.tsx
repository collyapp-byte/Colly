"use client";

import { useState, type FormEvent } from "react";
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

const LABEL_CLASS = "mb-1 block text-sm font-medium text-gray-700";
const INPUT_CLASS =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-colly focus:ring-2 focus:ring-colly/20";
const AVATAR_CLASS =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold text-gray-600";

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
        owner ? "bg-[#FFF4EC] text-[#FF6600]" : "bg-gray-100 text-gray-600"
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

  const [pendingRemoval, setPendingRemoval] =
    useState<TeamMemberView | null>(null);
  const [removing, setRemoving] = useState(false);

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

      toast.success(`Invite saved for ${trimmedEmail}`);
      setEmail("");
      setName("");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setInviting(false);
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
              <span className="font-normal text-gray-400">(optional)</span>
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
            <p className="text-xs text-gray-500">
              We do not email anyone yet — share the address with your teammate
              and they join the moment they sign up with it.
            </p>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader
          title="Your team"
          subtitle="Everyone who can sign in to this workspace."
          action={
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500">
              <Users className="h-4 w-4" aria-hidden />
              {staffLabel}
            </span>
          }
        />

        <ul className="mt-4 divide-y divide-gray-100">
          {/* The owner is a User row, never a TeamMember — it cannot be removed. */}
          <li className="flex items-center gap-3 py-3">
            <span className={AVATAR_CLASS} aria-hidden>
              {initials(ownerName, owner.email)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">
                {ownerName}{" "}
                <span className="font-normal text-gray-400">(you)</span>
              </p>
              <p className="truncate text-xs text-gray-500">{owner.email}</p>
            </div>
            <RoleBadge role="OWNER" />
          </li>

          {members.map((member) => (
            <li key={member.id} className="flex items-center gap-3 py-3">
              <span className={AVATAR_CLASS} aria-hidden>
                {initials(member.name, member.email)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">
                  {member.name || member.email}
                </p>
                <p className="truncate text-xs text-gray-500">
                  {member.email}
                  {formatInvited(member.createdAt) && (
                    <span className="text-gray-400">
                      {" "}
                      · {formatInvited(member.createdAt)}
                    </span>
                  )}
                </p>
              </div>
              <RoleBadge role="STAFF" />
              <button
                type="button"
                onClick={() => setPendingRemoval(member)}
                aria-label={`Remove ${member.name || member.email}`}
                title="Remove access"
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-4 focus:ring-red-500/20"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>

        {members.length === 0 && (
          <p className="mt-2 rounded-lg bg-gray-50 p-4 text-sm text-gray-500">
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
          <p className="text-sm text-gray-600">
            <strong className="font-semibold text-gray-900">
              {pendingRemoval.name || pendingRemoval.email}
            </strong>{" "}
            will lose access to your dashboard on their next request. Their
            account is not deleted — you can invite the same address again later.
          </p>
          <p className="mt-3 text-xs text-gray-500">{pendingRemoval.email}</p>
        </Modal>
      )}
    </div>
  );
}
