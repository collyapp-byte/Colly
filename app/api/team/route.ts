import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOwnerApi } from "@/lib/auth";
import { isValidEmail } from "@/lib/validators";
import { TEAM_MEMBER_NAME_MAX } from "@/lib/team";
import { isTeamRole, type TeamMemberView, type TeamRole } from "@/lib/team";
import { sendTeamInviteEmail, teamInviteLink } from "@/lib/team-invite";
import {
  cursorDate,
  decodeCursor,
  encodeCursor,
  readPageSize,
} from "@/lib/pagination";

function badRequest(error: string) {
  return Response.json({ error }, { status: 400 });
}

function notFound(error: string) {
  return Response.json({ error }, { status: 404 });
}

function conflict(error: string) {
  return Response.json({ error }, { status: 409 });
}

const TEAM_MEMBER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  createdAt: true,
} satisfies Prisma.TeamMemberSelect;

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

function toTeamMemberView(row: Prisma.TeamMemberGetPayload<{ select: typeof TEAM_MEMBER_SELECT }>): TeamMemberView {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: isTeamRole(row.role) ? row.role : "STAFF",
    createdAt: row.createdAt.toISOString(),
  };
}

// GET /api/team?cursor=&limit=
// Keyset-paginated list of the caller's team members (newest first).
export async function GET(request: Request) {
  const auth = await requireOwnerApi();
  if (!auth.ok) return auth.response;

  const businessId = auth.user.businessId;
  const { searchParams } = new URL(request.url);
  const limit = readPageSize(searchParams);
  const cursor = decodeCursor(searchParams.get("cursor"));
  const cursorCreatedAt = cursorDate(cursor, "createdAt");
  const cursorId = cursor?.id ?? null;

  const after =
    cursorCreatedAt && cursorId
      ? {
          OR: [
            { createdAt: { lt: cursorCreatedAt } },
            { createdAt: cursorCreatedAt, id: { lt: cursorId } },
          ],
        }
      : {};

  const rows = await prisma.teamMember.findMany({
    where: { businessId, ...after },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    select: TEAM_MEMBER_SELECT,
  });

  const last = rows.at(-1);
  const nextCursor =
    rows.length === limit && last
      ? encodeCursor({ createdAt: last.createdAt, id: last.id })
      : null;

  return Response.json({
    members: rows.map(toTeamMemberView),
    nextCursor,
  });
}

export async function POST(request: Request) {
  try {
    const auth = await requireOwnerApi();
    if (!auth.ok) {
      return auth.response;
    }

    const businessId = auth.user.businessId;
    const body = await request.json().catch(() => null);

    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const role = isTeamRole(body?.role) ? body.role : "STAFF";

    if (!email) return badRequest("An email address is required");
    if (!isValidEmail(email)) return badRequest("That does not look like an email address");
    if (name.length > TEAM_MEMBER_NAME_MAX) {
      return badRequest(`The name must be ${TEAM_MEMBER_NAME_MAX} characters or fewer`);
    }

    if (email === auth.user.email.trim().toLowerCase()) {
      return conflict("That is your own address — you already own this business");
    }

    const ownerRow = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (ownerRow) {
      return conflict("That address already owns a Colly business, so it cannot join as staff");
    }

    const existing = await prisma.teamMember.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { businessId: true },
    });
    if (existing) {
      return conflict(
        existing.businessId === businessId
          ? "That person is already on your team"
          : "That address is already on another business's team"
      );
    }

    const member = await prisma.teamMember.create({
      data: {
        businessId,
        email,
        name: name || nameFromEmail(email),
        role,
      },
      select: TEAM_MEMBER_SELECT,
    });

    const link = teamInviteLink(member.id);
    const delivery = await sendTeamInviteEmail({
      businessName: auth.user.businessName || "Your Business",
      inviterName: auth.user.name || "The Owner",
      inviteeName: member.name,
      email: member.email,
      link,
    });

    if (!delivery.sent) {
      console.warn(`[POST /api/team] invite email was not sent (${delivery.error ?? "unknown"})`);
    }

    return Response.json(
      { member, invite: { emailed: delivery.sent, link } },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return conflict("That address is already on another business's team");
    }

    console.error("[POST /api/team]", error);
    return Response.json(
      {
        error: "Failed to invite that person",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireOwnerApi();
    if (!auth.ok) return auth.response;

    const businessId = auth.user.businessId;
    const body = (await request.json().catch(() => null)) as {
      id?: unknown;
      role?: unknown;
      name?: unknown;
      email?: unknown;
    } | null;

    const id = typeof body?.id === "string" ? body.id.trim() : "";
    if (!id) return badRequest("id is required");

    const existing = await prisma.teamMember.findFirst({
      where: { id, businessId },
      select: { id: true },
    });
    if (!existing) return notFound("Team member not found");

    const data: { role?: TeamRole; name?: string; email?: string } = {};

    if (body?.role !== undefined) {
      if (!isTeamRole(body.role)) {
        return badRequest('Role must be "OWNER" or "STAFF"');
      }
      data.role = body.role;
    }

    if (body?.name !== undefined) {
      if (typeof body.name !== "string") {
        return badRequest("Name must be a string");
      }
      const name = body.name.trim();
      if (name.length > TEAM_MEMBER_NAME_MAX) {
        return badRequest(`Name must be ${TEAM_MEMBER_NAME_MAX} characters or less`);
      }
      data.name = name || undefined;
    }

    if (body?.email !== undefined) {
      if (typeof body.email !== "string") {
        return badRequest("Email must be a string");
      }
      const email = body.email.trim().toLowerCase();
      if (!isValidEmail(email)) {
        return badRequest("That does not look like an email address");
      }
      data.email = email;
    }

    if (Object.keys(data).length === 0) {
      return badRequest("No fields to update");
    }

    const updated = await prisma.teamMember.update({
      where: { id },
      data,
      select: TEAM_MEMBER_SELECT,
    });

    return Response.json({ member: toTeamMemberView(updated) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return conflict("That address is already on another business's team");
    }
    console.error("[PATCH /api/team]", error);
    return Response.json(
      {
        error: "Failed to change that team member",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await requireOwnerApi();
    if (!auth.ok) {
      return auth.response;
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id")?.trim() ?? "";

    if (!id) return badRequest("id is required");

    const removed = await prisma.teamMember.deleteMany({
      where: { id, businessId: auth.user.businessId },
    });

    if (removed.count === 0) return notFound("Team member not found");

    return Response.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/team]", error);
    return Response.json(
      {
        error: "Failed to remove that person",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}