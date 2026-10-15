import { prisma } from "@/lib/prisma";
import { getCurrentAgent } from "@/lib/agent-auth";

/** Marks a lesson complete for the signed-in agent (idempotent upsert). */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ lessonId: string }> },
) {
  try {
    const agent = await getCurrentAgent();
    if (!agent) {
      return Response.json({ error: "Not signed in" }, { status: 401 });
    }

    const { lessonId } = await params;

    const lesson = await prisma.agentLesson.findUnique({
      where: { id: lessonId },
      select: { id: true },
    });

    if (!lesson) {
      return Response.json({ error: "Lesson not found" }, { status: 404 });
    }

    await prisma.agentLessonProgress.upsert({
      where: { agentId_lessonId: { agentId: agent.id, lessonId } },
      create: { agentId: agent.id, lessonId },
      update: {},
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error("[POST /api/agents/lessons/[lessonId]/complete]", error);
    return Response.json(
      {
        error: "Failed to save your progress",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
