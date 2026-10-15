import type { Agent } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentAgent } from "@/lib/agent-auth";
import { generateCertificateId } from "@/lib/agent-id";

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
 * Grades a course quiz for the signed-in agent, records the attempt, and issues
 * the certificate once the agent has passed every course's quiz.
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

    const certified = passed ? await ensureCertified(agent) : agent.certifiedAt !== null;

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

/**
 * Issues the certificate when the agent has passed every certification course
 * quiz. Returns whether the agent is certified afterwards. Idempotent: a second
 * call with the certificate already present leaves it untouched, and adding new
 * (non-certification) courses never revokes an existing certificate.
 */
async function ensureCertified(agent: Agent): Promise<boolean> {
  if (agent.certifiedAt) return true;

  // Only courses flagged as certification courses gate certification.
  const certCourses = await prisma.agentCourse.findMany({
    where: { isCertificationCourse: true, published: true, questions: { some: {} } },
    select: { id: true },
  });

  if (certCourses.length === 0) return false;

  const passedAttempts = await prisma.agentQuizAttempt.findMany({
    where: {
      agentId: agent.id,
      passed: true,
      courseId: { in: certCourses.map((course) => course.id) },
    },
    select: { courseId: true },
    distinct: ["courseId"],
  });

  const passedCourseIds = new Set(passedAttempts.map((row) => row.courseId));
  const passedAll = certCourses.every((course) => passedCourseIds.has(course.id));

  if (!passedAll) return false;

  await prisma.$transaction([
    prisma.agentCertificate.upsert({
      where: { agentId: agent.id },
      create: {
        agentId: agent.id,
        certificateId: generateCertificateId(agent.agentNumber),
      },
      update: {},
    }),
    prisma.agent.update({
      where: { id: agent.id },
      data: { certifiedAt: new Date() },
    }),
  ]);

  return true;
}
