"use client";

import { renderAgentCertificationBadgeSvg } from "@/lib/agent-certification-badge";

/**
 * The standalone "Certified Agent" badge, rendered as inline SVG.
 *
 * The markup comes from `renderAgentCertificationBadgeSvg` (the same builder the
 * PNG/SVG download route uses), so the on-page badge and the downloadable asset
 * can never drift. The source is generated locally from trusted values, so
 * injecting it directly is safe.
 */
type AgentCertificationBadgeProps = {
  fullName?: string | null;
  year?: number;
  /** Rendered edge length in px. Defaults to 240. */
  size?: number;
};

export function AgentCertificationBadge({
  fullName,
  year,
  size = 240,
}: AgentCertificationBadgeProps) {
  const svg = renderAgentCertificationBadgeSvg({
    fullName,
    year,
    logoSrc: "/logo.png",
  });

  return (
    <span
      className="inline-block [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
