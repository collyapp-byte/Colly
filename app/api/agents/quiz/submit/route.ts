import { prisma } from "@/lib/prisma";
import { getCurrentAgent } from "@/lib/agent-auth";
import { awardBadgeIfEligible } from "@/lib/badges";

/** A quiz passes at 80% or above. */
const PASS_MARK = 80;

type SubmitBody = {
  courseSlug?: unknown;
  answers?: unknown;
};

function toOptions(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/**
 * Grades a course quiz for the signed-in agent and records the attempt. Passing
 * awards the course badge; certification itself is gated on the Final
 * Certification Exam (see `lib/certification.ts`), not on course quizzes.
 */
export async function POST(request: Request) {
  try {
    const agent = await getCurrentAgent();
    if (!agent) {
      return Response.json({ error: "Not signed in" }, { status: 401 });
    }

    let body: SubmitBody;
    try {
      body = (await request.json()) as SubmitBody;
    } catch {
      return Response.json({ error: "Invalid request body." }, { status: 400 });
    }

    const courseSlug =
      typeof body.courseSlug === "string" ? body.courseSlug : "";
    const answers = Array.isArray(body.answers) ? body.answers : null;

    if (!courseSlug || !answers) {
      return Response.json(
        { error: "A course and answers are required." },
        { status: 400 },
      );
    }

    const course = await prisma.agentCourse.findUnique({
      where: { slug: courseSlug },
      include: { questions: { orderBy: { order: "asc" } } },
    });

    if (!course || !course.published) {
      return Response.json({ error: "Course not found" }, { status: 404 });
    }

    if (course.questions.length === 0) {
      return Response.json(
        { error: "This course has no quiz." },
        { status: 400 },
      );
    }

    if (answers.length !== course.questions.length) {
      return Response.json(
        { error: "Answer every question before submitting." },
        { status: 400 },
      );
    }

    let correct = 0;
    for (let i = 0; i < course.questions.length; i++) {
      const question = course.questions[i];
      const optionCount = toOptions(question.options).length;
      const chosen = answers[i];

      if (
        typeof chosen !== "number" ||
        !Number.isInteger(chosen) ||
        chosen < 0 ||
        chosen >= optionCount
      ) {
        return Response.json(
          { error: "Every answer must be a valid option." },
          { status: 400 },
        );
      }

      if (chosen === question.correctIndex) {
        correct += 1;
      }
    }

    const score = Math.round((correct / course.questions.length) * 100);
    const passed = score >= PASS_MARK;

    await prisma.agentQuizAttempt.create({
      data: {
        agentId: agent.id,
        courseId: course.id,
        score,
        passed,
        answers,
      },
    });

    if (passed) {
      // Award the course badge when every lesson is done and the quiz passed.
      // Never fail the submission: the badge can be awarded on the next pass.
      try {
        await awardBadgeIfEligible(agent.id, course.slug);
      } catch (error) {
        console.error(
          "[POST /api/agents/quiz/submit] badge award failed",
          error,
        );
      }
    }

    const certified = agent.certifiedAt !== null;

    return Response.json({ score, passed, certified });
  } catch (error) {
    console.error("[POST /api/agents/quiz/submit]", error);
    return Response.json(
      {
        error: "Failed to submit your quiz",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
