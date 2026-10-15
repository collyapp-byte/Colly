import { prisma } from "@/lib/prisma";
import { getCurrentBusinessId } from "@/lib/auth";
import { reembedFAQ } from "@/lib/embedding-pipeline";

type FaqRequestBody = {
  question?: unknown;
  answer?: unknown;
  category?: unknown;
};

function badRequest(error: string) {
  return Response.json({ error }, { status: 400 });
}

function notFound() {
  return Response.json({ error: "FAQ not found" }, { status: 404 });
}

function unauthorized() {
  return Response.json({ error: "Not signed in" }, { status: 401 });
}

// PATCH /api/faqs/[id]
// Body: any subset of { question, answer, category }
export async function PATCH(
  request: Request,
  context: RouteContext<"/api/faqs/[id]">,
) {
  try {
    const businessId = await getCurrentBusinessId();

    if (!businessId) {
      return unauthorized();
    }

    const { id } = await context.params;
    const body = (await request.json()) as FaqRequestBody;

    const data: {
      question?: string;
      answer?: string;
      category?: string | null;
    } = {};

    if (body.question !== undefined) {
      if (typeof body.question !== "string" || body.question.trim() === "") {
        return badRequest("Question cannot be empty");
      }
      data.question = body.question.trim();
    }

    if (body.answer !== undefined) {
      if (typeof body.answer !== "string" || body.answer.trim() === "") {
        return badRequest("Answer cannot be empty");
      }
      data.answer = body.answer.trim();
    }

    if (body.category !== undefined) {
      if (body.category !== null && typeof body.category !== "string") {
        return badRequest("Category must be text");
      }
      data.category =
        typeof body.category === "string" ? body.category.trim() || null : null;
    }

    if (Object.keys(data).length === 0) {
      return badRequest("No valid fields provided");
    }

    // Scoped by businessId: an FAQ belonging to another tenant reads as
    // "not found" rather than being editable.
    const existing = await prisma.faq.findFirst({ where: { id, businessId } });
    if (!existing) {
      return notFound();
    }

    const faq = await prisma.faq.update({ where: { id }, data });

    // Re-embed on every update so question/answer/category changes stay searchable.
    void reembedFAQ(faq.id).catch((error) => {
      console.error("[embeddings] failed to embed FAQ", faq.id, error);
    });

    return Response.json({ faq });
  } catch (error) {
    console.error("[PATCH /api/faqs/[id]]", error);
    return Response.json(
      {
        error: "Failed to update FAQ",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// DELETE /api/faqs/[id]
export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/faqs/[id]">,
) {
  try {
    const businessId = await getCurrentBusinessId();

    if (!businessId) {
      return unauthorized();
    }

    const { id } = await context.params;

    const existing = await prisma.faq.findFirst({ where: { id, businessId } });
    if (!existing) {
      return notFound();
    }

    await prisma.faq.delete({ where: { id } });

    return Response.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/faqs/[id]]", error);
    return Response.json(
      {
        error: "Failed to delete FAQ",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
