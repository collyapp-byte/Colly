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

function unauthorized() {
  return Response.json({ error: "Not signed in" }, { status: 401 });
}

// GET /api/faqs
// Every FAQ for the signed-in business, grouped by category (nulls last),
// oldest first within each category.
export async function GET() {
  try {
    const businessId = await getCurrentBusinessId();

    if (!businessId) {
      return unauthorized();
    }

    const faqs = await prisma.faq.findMany({
      where: { businessId },
      orderBy: [
        { category: { sort: "asc", nulls: "last" } },
        { createdAt: "asc" },
      ],
    });

    return Response.json({ faqs });
  } catch (error) {
    console.error("[GET /api/faqs]", error);
    return Response.json(
      {
        error: "Failed to load FAQs",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// POST /api/faqs
// Body: { question: string, answer: string, category?: string }
export async function POST(request: Request) {
  try {
    const businessId = await getCurrentBusinessId();

    if (!businessId) {
      return unauthorized();
    }

    const body = (await request.json()) as FaqRequestBody;
    const question =
      typeof body.question === "string" ? body.question.trim() : "";
    const answer = typeof body.answer === "string" ? body.answer.trim() : "";
    const category =
      typeof body.category === "string" ? body.category.trim() : "";

    if (!question) {
      return badRequest("Question is required");
    }
    if (!answer) {
      return badRequest("Answer is required");
    }

    const faq = await prisma.faq.create({
      data: {
        businessId,
        question,
        answer,
        category: category || null,
      },
    });

    // Embed for semantic search without making the owner wait on Jina.
    void reembedFAQ(faq.id).catch((error) => {
      console.error("[embeddings] failed to embed FAQ", faq.id, error);
    });

    return Response.json({ faq }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/faqs]", error);
    return Response.json(
      {
        error: "Failed to create FAQ",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
