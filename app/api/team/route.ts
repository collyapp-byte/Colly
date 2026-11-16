import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireOwnerApi } from "@/lib/auth";
import { isValidEmail } from "@/lib/validators";
import { TEAM_MEMBER_NAME_MAX } from "@/lib/team";
import { sendTeamInviteEmail, teamInviteLink } from "@/lib/team-invite";

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
        role: "STAFF",
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