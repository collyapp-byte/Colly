import { createElement } from "react";
import QRCode from "qrcode";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { getCurrentAgent } from "@/lib/agent-auth";
import { collyLogoDataUri } from "@/lib/badge-assets";
import { AgentCertificatePdf } from "@/components/agents/agent-certificate-pdf";

/** Resolves the public base URL used in the certificate's verification link. */
function resolveOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  return new URL(request.url).origin;
}

/** Streams the signed-in agent's certificate as a downloadable PDF. */
export async function GET(request: Request) {
  try {
    const agent = await getCurrentAgent();
    if (!agent) {
      return Response.json({ error: "Not signed in" }, { status: 401 });
    }

    const certificate = await prisma.agentCertificate.findUnique({
      where: { agentId: agent.id },
      select: { certificateId: true, issuedAt: true },
    });

    if (!certificate) {
      return Response.json(
        { error: "You are not certified yet." },
        { status: 404 },
      );
    }

    const verifyUrl = `${resolveOrigin(request)}/verify/${agent.agentNumber}`;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
      margin: 2,
      width: 200,
    });

    const issuedAt = new Intl.DateTimeFormat("en-NG", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(certificate.issuedAt);

    // react-pdf can only embed raster images, so use the PNG logo and skip it
    // entirely if only the (non-rasterisable) SVG fallback is available.
    const logo = await collyLogoDataUri();
    const logoSrc = logo.startsWith("data:image/png") ? logo : undefined;

    // createElement infers the element's props from the component, but
    // renderToBuffer is typed against its own DocumentProps; the cast bridges
    // the two without leaking react-pdf types through the component.
    const element = createElement(AgentCertificatePdf, {
      fullName: agent.fullName,
      agentNumber: agent.agentNumber,
      certificateId: certificate.certificateId,
      issuedAt,
      verifyUrl,
      qrDataUrl,
      logoSrc,
    }) as Parameters<typeof renderToBuffer>[0];

    const buffer = await renderToBuffer(element);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="colly-agent-${agent.agentNumber}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[GET /api/agents/certificate/pdf]", error);
    return Response.json(
      {
        error: "Failed to build your certificate",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
