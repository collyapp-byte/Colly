import { prisma } from "@/lib/prisma";
import { getCurrentAgent } from "@/lib/agent-auth";

/**
 * A single lesson inside a course, for the signed-in agent, plus its previous
 * and next sibling slugs for navigation.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ courseSlug: string; lessonSlug: string }> },
) {
  try {
    const agent = await getCurrentAgent();
    if (!agent) {
      return Response.json({ error: "Not signed in" }, { status: 401 });
    }

    const { courseSlug, lessonSlug } = await params;

    const course = await prisma.agentCourse.findUnique({
      where: { slug: courseSlug },
      include: {
        lessons: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            slug: true,
            title: true,
            order: true,
            bodyMarkdown: true,
            youtubeUrl: true,
            durationMin: true,
          },
        },
      },
    });

    if (!course || !course.published) {
      return Response.json({ error: "Course not found" }, { status: 404 });
    }

    const index = course.lessons.findIndex(
      (lesson) => lesson.slug === lessonSlug,
    );
    if (index === -1) {
      return Response.json({ error: "Lesson not found" }, { status: 404 });
    }

    const lesson = course.lessons[index];
    const progress = await prisma.agentLessonProgress.findUnique({
      where: {
        agentId_lessonId: { agentId: agent.id, lessonId: lesson.id },
      },
      select: { id: true },
    });

    return Response.json({
      course: { slug: course.slug, title: course.title },
      lesson: {
        id: lesson.id,
        slug: lesson.slug,
        title: lesson.title,
        bodyMarkdown: lesson.bodyMarkdown,
        youtubeUrl: lesson.youtubeUrl,
        durationMin: lesson.durationMin,
        completed: progress !== null,
      },
      prevSlug: index > 0 ? course.lessons[index - 1].slug : null,
      nextSlug:
        index < course.lessons.length - 1
          ? course.lessons[index + 1].slug
          : null,
    });
  } catch (error) {
    console.error("[GET /api/agents/training/[courseSlug]/[lessonSlug]]", error);
    return Response.json(
      {
        error: "Failed to load the lesson",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
