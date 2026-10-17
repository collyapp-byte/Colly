import { prisma } from "@/lib/prisma";
import { getCurrentAgent } from "@/lib/agent-auth";
import { hasAllBadges } from "@/lib/badges";
import { issueCertificateIfEligible } from "@/lib/certification";

const PASS_MARK = 80;

type SubmitBody = {
  answers?: unknown;
};

function toOptions(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export async function GET() {
  try {
    const agent = await getCurrentAgent();
    if (!agent) {
      return Response.json({ error: "Not signed in" }, { status: 401 });
    }
    const questions = await prisma.agentFinalExamQuestion.findMany({
      orderBy: { order: "asc" },
      select: {
        id: true,
        order: true,
        sectionTitle: true,
        question: true,
        options: true,
      },
    });
    const locked = !(await hasAllBadges(agent.id));
    return Response.json({
      questions,
      locked,
      alreadyPassed: agent.finalExamPassedAt !== null,
    });
  } catch (error) {
    console.error("[GET /api/agents/final-exam]", error);
    return Response.json(
      { error: "Failed to load final exam" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const agent = await getCurrentAgent();
    if (!agent) {
      return Response.json({ error: "Not signed in" }, { status: 401 });
    }
    if (!(await hasAllBadges(agent.id))) {
      return Response.json(
        { error: "Earn all four course badges to unlock the final exam." },
        { status: 403 },
      );
    }
    let body: SubmitBody;
    try {
      body = (await request.json()) as SubmitBody;
    } catch {
      return Response.json({ error: "Invalid request body." }, { status: 400 });
    }
    const answers = Array.isArray(body.answers) ? body.answers : null;
    if (!answers) {
      return Response.json({ error: "Answers are required." }, { status: 400 });
    }
    const questions = await prisma.agentFinalExamQuestion.findMany({
      orderBy: { order: "asc" },
    });
    if (questions.length === 0) {
      return Response.json({ error: "Final exam not set up." }, { status: 400 });
    }
    if (answers.length !== questions.length) {
      return Response.json(
        { error: "Answer every question before submitting." },
        { status: 400 }
      );
    }
    let correct = 0;
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const optionCount = toOptions(q.options).length;
      const chosen = answers[i];
      if (
        typeof chosen !== "number" ||
        !Number.isInteger(chosen) ||
        chosen < 0 ||
        chosen >= optionCount
      ) {
        return Response.json(
          { error: "Every answer must be a valid option." },
          { status: 400 }
        );
      }
      if (chosen === q.correctIndex) correct++;
    }
    const score = Math.round((correct / questions.length) * 100);
    const passed = score >= PASS_MARK;
    await prisma.agentFinalExamAttempt.create({
      data: {
        agentId: agent.id,
        score,
        passed,
        answers,
      },
    });
    if (passed && !agent.finalExamPassedAt) {
      await prisma.agent.update({
        where: { id: agent.id },
        data: { finalExamPassedAt: new Date() },
      });
    }
    // Passing the final exam is what confers certification. Idempotent, so a
    // re-submission after a pass leaves the existing certificate untouched.
    const certified = await issueCertificateIfEligible(agent.id);
    return Response.json({
      score,
      passed,
      total: questions.length,
      correct,
      certified,
    });
  } catch (error) {
    console.error("[POST /api/agents/final-exam]", error);
    return Response.json(
      { error: "Failed to submit final exam" },
      { status: 500 }
    );
  }
}