import { prisma } from "@/lib/prisma";
import { getCurrentBusinessId } from "@/lib/auth";

function unauthorized() {
  return Response.json({ error: "Not signed in" }, { status: 401 });
}

// GET /api/customers/[id]
// A single customer with all of their conversations, each carrying its status
// and a preview of the most recent message.
export async function GET(
  _request: Request,
  context: RouteContext<"/api/customers/[id]">,
) {
  try {
    const businessId = await getCurrentBusinessId();

    if (!businessId) {
      return unauthorized();
    }

    const { id } = await context.params;

    // Scoped by businessId so another tenant's customer reads as not found.
    const customer = await prisma.customer.findFirst({
      where: { id, businessId },
      include: {
        conversations: {
          include: {
            messages: {
              orderBy: { createdAt: "desc" },
              take: 1,
              select: { content: true, sender: true, createdAt: true },
            },
          },
        },
      },
    });

    if (!customer) {
      return Response.json({ error: "Customer not found" }, { status: 404 });
    }

    const conversations = customer.conversations
      .map((conversation) => ({
        conversation,
        lastActivityAt: (
          conversation.messages[0]?.createdAt ?? conversation.createdAt
        ).getTime(),
      }))
      .sort((a, b) => b.lastActivityAt - a.lastActivityAt)
      .map(({ conversation }) => {
        const last = conversation.messages[0] ?? null;

        return {
          id: conversation.id,
          status: conversation.status,
          createdAt: conversation.createdAt,
          lastMessage: last
            ? {
                content: last.content,
                sender: last.sender,
                createdAt: last.createdAt,
              }
            : null,
        };
      });

    return Response.json({
      customer: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        createdAt: customer.createdAt,
        conversations,
      },
    });
  } catch (error) {
    console.error("[GET /api/customers/[id]]", error);
    return Response.json(
      {
        error: "Failed to load customer",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
