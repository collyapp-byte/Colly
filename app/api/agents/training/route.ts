import { prisma } from "@/lib/prisma";
import { getCurrentAgent } from "@/lib/agent-auth";

/**
 * All published courses with the signed-in agent's progress in each. Used by
 * the training list page.
 */
export async function GET() {
  try {
    const agent = await getCurrentAgent();
    if (!agent) {
      return Response.json({ error: "Not signed in" }, { status: 401 });
    }

    const [courses, completed] = await Promise.all([
      prisma.agentCourse.findMany({
        where: { published: true },
        orderBy: { order: "asc" },
        select: {
          slug: true,
          title: true,
          description: true,
          lessons: { select: { id: true } },
        },
      }),
      prisma.agentLessonProgress.findMany({
        where: { agentId: agent.id },
        select: { lessonId: true },
      }),
    ]);

    const completedLessonIds = new Set(completed.map((row) => row.lessonId));

    return Response.json({
      courses: courses.map((course) => ({
        slug: course.slug,
        title: course.title,
        description: course.description,
        lessonCount: course.lessons.length,
        completedCount: course.lessons.filter((lesson) =>
          completedLessonIds.has(lesson.id),
        ).length,
      })),
    });
  } catch (error) {
    console.error("[GET /api/agents/training]", error);
    return Response.json(
      {
        error: "Failed to load courses",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
