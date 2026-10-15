import { prisma } from "@/lib/prisma";
import { getCurrentAgent } from "@/lib/agent-auth";

/** The signed-in agent's certificate, or null when they are not certified yet. */
export async function GET() {
  try {
    const agent = await getCurrentAgent();
    if (!agent) {
      return Response.json({ error: "Not signed in" }, { status: 401 });
    }

    const certificate = await prisma.agentCertificate.findUnique({
      where: { agentId: agent.id },
      select: { certificateId: true, issuedAt: true },
    });

    return Response.json({
      certified: agent.certifiedAt !== null,
      certificate: certificate
        ? {
            certificateId: certificate.certificateId,
            issuedAt: certificate.issuedAt,
          }
        : null,
      agent: {
        fullName: agent.fullName,
        agentNumber: agent.agentNumber,
      },
    });
  } catch (error) {
    console.error("[GET /api/agents/certificate]", error);
    return Response.json(
      {
        error: "Failed to load your certificate",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
