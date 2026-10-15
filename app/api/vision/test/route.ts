import { requireAuth } from "@/lib/auth";
import { describeImage } from "@/lib/vision";

type VisionTestRequestBody = {
  imageUrl?: unknown;
};

// POST /api/vision/test
// Body: { imageUrl: string }
// Requires a signed-in owner. Runs the Groq vision model against the given
// image URL and returns { description, isProduct }. Intended as a manual sanity
// check for the image recognition pipeline.
export async function POST(request: Request) {
  try {
    await requireAuth();

    const body = (await request.json()) as VisionTestRequestBody;

    if (typeof body.imageUrl !== "string" || body.imageUrl.length === 0) {
      return Response.json({ error: "imageUrl is required" }, { status: 400 });
    }

    const result = await describeImage(body.imageUrl);

    return Response.json(result);
  } catch (error) {
    console.error("[POST /api/vision/test]", error);
    return Response.json(
      {
        error: "Failed to describe image",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
