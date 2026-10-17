import { prisma } from "@/lib/prisma";
import { generateCertificateId } from "@/lib/agent-id";

/**
 * Issues the agent's certificate once they have passed the Final Certification
 * Exam.
 *
 * Certification is gated on the final exam (score >= 80), NOT on passing the
 * individual course quizzes — those only award badges. Idempotent: an agent who
 * is already certified is reported as true without touching the stored
 * certificate, so a certificate is never re-issued or re-dated.
 */
export async function issueCertificateIfEligible(
  agentId: string,
): Promise<boolean> {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { agentNumber: true, certifiedAt: true, finalExamPassedAt: true },
  });

  if (!agent) return false;
  if (agent.certifiedAt) return true;
  if (!agent.finalExamPassedAt) return false;

  await prisma.$transaction([
    prisma.agentCertificate.upsert({
      where: { agentId },
      create: {
        agentId,
        certificateId: generateCertificateId(agent.agentNumber),
      },
      update: {},
    }),
    prisma.agent.update({
      where: { id: agentId },
      data: { certifiedAt: new Date() },
    }),
  ]);

  return true;
}
