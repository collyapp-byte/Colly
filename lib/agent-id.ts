import { prisma } from "@/lib/prisma";

const AGENT_NUMBER_PREFIX = "AG-";

/**
 * The next agent number in the sequence, zero-padded to four digits
 * ("AG-0001", "AG-0042", ...).
 *
 * Scans the existing numbers rather than keeping a counter row, so the seed and
 * signup can never drift apart. Callers that create the Agent row should retry
 * on a unique-constraint collision, since two signups can race here.
 */
export async function generateAgentNumber(): Promise<string> {
  const agents = await prisma.agent.findMany({
    where: { agentNumber: { startsWith: AGENT_NUMBER_PREFIX } },
    select: { agentNumber: true },
  });

  let highest = 0;
  for (const { agentNumber } of agents) {
    const parsed = Number.parseInt(
      agentNumber.slice(AGENT_NUMBER_PREFIX.length),
      10,
    );
    if (Number.isFinite(parsed) && parsed > highest) {
      highest = parsed;
    }
  }

  return `${AGENT_NUMBER_PREFIX}${String(highest + 1).padStart(4, "0")}`;
}

/**
 * The public certificate id for an agent, e.g. "CERT-AG-0001-2026". The year is
 * the issue year, so the id is stable once issued.
 */
export function generateCertificateId(
  agentNumber: string,
  year: number = new Date().getFullYear(),
): string {
  return `CERT-${agentNumber}-${year}`;
}
