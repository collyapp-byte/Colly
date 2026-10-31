import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireOwnerApi } from "@/lib/auth";
import { isValidEmail } from "@/lib/validators";
import {
  cursorDate,
  decodeCursor,
  encodeCursor,
  readPageSize,
} from "@/lib/pagination";
import { isTeamRole, TEAM_MEMBER_NAME_MAX } from "@/lib/team";

function badRequest(error: string) {
  return Response.json({ error }, { status: 400 });
}

function notFound(error: string) {
  return Response.json({ error }, { status: 404 });
}

function conflict(error: string) {
  return Response.json({ error }, { status: 409 });
}

/** The columns every response exposes — never the whole row. */
const TEAM_MEMBER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
} satisfies Prisma.TeamMemberSelect;

type InviteBody = {
  email?: unknown;
  name?: unknown;
};

/**
 * A display name for an invite that only carried an address: "ada.okafor@…"
 * becomes "Ada Okafor". `TeamMember.name` is required in the schema, and the
 * settings page has something to show before the person signs in.
 */
function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const words = local.replace(/[._+-]+/g, " ").trim();
  const name = words
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return (name || "Team member").slice(0, TEAM_MEMBER_NAME_MAX);
}

// GET /api/team?limit=50&cursor=...
// The owner plus the staff invited to this business, newest first.
//
// Owner-only (Team Collaboration): the team list is an owner area, so an invited
// STAFF session gets the 403 from `requireOwnerApi()` — the proxy skips `/api`,
// which makes the guard here the real gate. Keyset paginated like the other list
// endpoints: pass `nextCursor` back as `cursor` for the next page.
export async function GET(request: Request) {
  try {
    const auth = await requireOwnerApi();

    if (!auth.ok) {
      return auth.response;
    }

    const { businessId, email: ownerEmail, name: ownerName } = auth.user;
    const { searchParams } = new URL(request.url);
    const limit = readPageSize(searchParams);
    const cursor = decodeCursor(searchParams.get("cursor"));
    const cursorCreatedAt = cursorDate(cursor, "createdAt");
    const cursorId = cursor?.id ?? null;

    const where: Prisma.TeamMemberWhereInput = { businessId };

    // Continue strictly after the last row of the previous page.
    if (cursorCreatedAt && cursorId) {
      where.AND = [
        {
          OR: [
            { createdAt: { lt: cursorCreatedAt } },
            { createdAt: cursorCreatedAt, id: { lt: cursorId } },
          ],
        },
      ];
    }

    const members = await prisma.teamMember.findMany({
      where,
      select: TEAM_MEMBER_SELECT,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
    });

    const lastMember = members.at(-1);
    const nextCursor =
      members.length === limit && lastMember
        ? encodeCursor({ createdAt: lastMember.createdAt, id: lastMember.id })
        : null;

    return Response.json({
      // The owner comes from the session, not from a second query: the `User`
      // row is what the login link (and the "Owner" row in the UI) is built on.
      owner: {
        email: ownerEmail,
        name: ownerName,
        role: "OWNER" as const,
      },
      members: members.map((member) => ({
        ...member,
        // `role` is a string column; anything unexpected is read as STAFF,
        // exactly like lib/auth.ts#loadTeamMember does.
        role: isTeamRole(member.role) ? member.role : ("STAFF" as const),
      })),
      nextCursor,
    });
  } catch (error) {
    console.error("[GET /api/team]", error);
    return Response.json(
      {
        error: "Failed to load your team",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// POST /api/team
// Body: { email, name? }
// Invites a staff member. The row only pre-authorises the address: there is no
// invite email to send, so the person signs up (or signs in) with that exact
// address and `lib/auth.ts#loadTenant` resolves them to this business as STAFF.
// Access starts when they sign in and ends the moment the row is deleted here.
export async function POST(request: Request) {
  try {
    const auth = await requireOwnerApi();

    if (!auth.ok) {
      return auth.response;
    }

    const businessId = auth.user.businessId;
    const body = (await request.json().catch(() => null)) as InviteBody | null;

    // Lower-cased so the unique index and the case-insensitive session lookup
    // can never disagree about who an invite refers to.
    const email =
      typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const name = typeof body?.name === "string" ? body.name.trim() : "";

    if (!email) {
      return badRequest("An email address is required");
    }

    if (!isValidEmail(email)) {
      return badRequest("That does not look like an email address");
    }

    if (name.length > TEAM_MEMBER_NAME_MAX) {
      return badRequest(
        `The name must be ${TEAM_MEMBER_NAME_MAX} characters or fewer`,
      );
    }

    // Two addresses can never become staff: the owner's own (they already have
    // full access) and the owner of another business (the `User` row wins over
    // a `TeamMember` row in loadTenant, so the invite would silently do nothing).
    if (email === auth.user.email.trim().toLowerCase()) {
      return conflict("That is your own address — you already own this business");
    }

    const ownerRow = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (ownerRow) {
      return conflict(
        "That address already owns a Colly business, so it cannot join as staff",
      );
    }

    const existing = await prisma.teamMember.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { businessId: true },
    });
    if (existing) {
      return conflict(
        existing.businessId === businessId
          ? "That person is already on your team"
          : "That address is already on another business's team",
      );
    }

    const member = await prisma.teamMember.create({
      data: {
        businessId,
        email,
        name: name || nameFromEmail(email),
        role: "STAFF",
      },
      select: TEAM_MEMBER_SELECT,
    });

    return Response.json({ member }, { status: 201 });
  } catch (error) {
    // The unique index on TeamMember.email is the real authority: two owners
    // inviting the same address at the same moment both pass the check above.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return conflict("That address is already on another business's team");
    }

    console.error("[POST /api/team]", error);
    return Response.json(
      {
        error: "Failed to invite that person",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// DELETE /api/team?id=...
// Removes a staff member, which ends their access on their next request
// (loadTenant no longer finds a row, so requireAuth sends them to /signup).
// Scoped with deleteMany rather than delete: an id belonging to another
// business must read as "not found", never as a successful removal.
export async function DELETE(request: Request) {
  try {
    const auth = await requireOwnerApi();

    if (!auth.ok) {
      return auth.response;
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id")?.trim() ?? "";

    if (!id) {
      return badRequest("id is required");
    }

    const removed = await prisma.teamMember.deleteMany({
      where: { id, businessId: auth.user.businessId },
    });

    if (removed.count === 0) {
      return notFound("Team member not found");
    }

    return Response.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/team]", error);
    return Response.json(
      {
        error: "Failed to remove that person",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
