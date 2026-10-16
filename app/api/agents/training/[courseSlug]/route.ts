import { prisma } from "@/lib/prisma";
import { getCurrentAgent } from "@/lib/agent-auth";

/**
 * A single course for the signed-in agent: its ordered lessons (with completion
 * flags), whether every lesson is complete, and -- only once it is -- the quiz
 * questions (without their correct answers).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ courseSlug: string }> },
) {
  try {
    const agent = await getCurrentAgent();
    if (!agent) {
      return Response.json({ error: "Not signed in" }, { status: 401 });
    }

    const { courseSlug } = await params;

    const course = await prisma.agentCourse.findUnique({
      where: { slug: courseSlug },
      include: {
        lessons: {
          orderBy: { order: "asc" },
          select: { id: true, slug: true, title: true, order: true, durationMin: true },
        },
        questions: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            order: true,
            question: true,
            options: true,
            correctIndex: true,
            explanation: true,
          },
        },
      },
    });

    if (!course || !course.published) {
      return Response.json({ error: "Course not found" }, { status: 404 });
    }

    const completed = await prisma.agentLessonProgress.findMany({
      where: { agentId: agent.id, lesson: { courseId: course.id } },
      select: { lessonId: true },
    });
    const completedLessonIds = new Set(completed.map((row) => row.lessonId));

    const lessons = course.lessons.map((lesson) => ({
      id: lesson.id,
      slug: lesson.slug,
      title: lesson.title,
      order: lesson.order,
      durationMin: lesson.durationMin,
      completed: completedLessonIds.has(lesson.id),
    }));

    const allLessonsComplete =
      lessons.length > 0 && lessons.every((lesson) => lesson.completed);
    const quizAvailable = allLessonsComplete && course.questions.length > 0;

    return Response.json({
      course: {
        slug: course.slug,
        title: course.title,
        description: course.description,
      },
      lessons,
      allLessonsComplete,
      quizAvailable,
      questions: quizAvailable
          ? course.questions.map((question) => ({
              id: question.id,
              order: question.order,
              question: question.question,
              options: question.options,
              correctIndex: question.correctIndex,
              explanation: question.explanation,
            }))
        : [],
    });
  } catch (error) {
    console.error("[GET /api/agents/training/[courseSlug]]", error);
    return Response.json(
      {
        error: "Failed to load the course",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
