/**
 * Single source of truth for the standalone "Certified Agent" badge artwork.
 *
 * The same markup is used in two places:
 * - `components/agents/agent-certification-badge.tsx` renders it inline on the
 *   certificate page.
 * - `app/api/agents/certificate/badge/route.ts` rasterises it to a PNG (and
 *   serves the SVG) for LinkedIn sharing.
 *
 * The builder is intentionally pure (no Node APIs, no fonts to register) so it
 * can run on both the server and the client. Callers pass in `logoSrc` because
 * the server embeds a data URI while the browser can use the public path.
 *
 * Styling follows the clean, professional IBM/Microsoft badge convention: a
 * white card, the brand mark and wordmark, a small-caps programme line, the
 * holder's name, a bold CERTIFIED line and the year.
 */

export type AgentCertificationBadgeOptions = {
  /** Holder's name. Falls back to "Certified Agent" when absent. */
  fullName?: string | null;
  /** Certification year. Defaults to the current year. */
  year?: number;
  /** Logo source: a data URI on the server, or a public path in the browser. */
  logoSrc: string;
};

/** The badge is authored at this square size (px) and rasterised 1:1. */
export const CERTIFICATION_BADGE_SIZE = 500;

const ORANGE = "#FF6600";
const INK = "#111827";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";

const FONT = "Helvetica, Arial, sans-serif";

/** Escapes the five XML-sensitive characters so names/ids can't break markup. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Keeps long names inside the card by stepping the type size down. */
function nameFontSize(name: string): number {
  if (name.length > 24) return 22;
  if (name.length > 18) return 26;
  return 30;
}

export function renderAgentCertificationBadgeSvg({
  fullName,
  year = new Date().getFullYear(),
  logoSrc,
}: AgentCertificationBadgeOptions): string {
  const size = CERTIFICATION_BADGE_SIZE;
  const name = (fullName?.trim() || "Certified Agent").slice(0, 48);
  const displayName = escapeXml(name);
  const logo = escapeXml(logoSrc);
  const yearText = escapeXml(String(year));

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Colly Certified Agent badge">
  <defs>
    <clipPath id="badge-clip">
      <rect x="0" y="0" width="${size}" height="${size}" rx="28" />
    </clipPath>
  </defs>
  <rect x="0.5" y="0.5" width="${size - 1}" height="${size - 1}" rx="28" fill="#FFFFFF" stroke="${BORDER}" stroke-width="1" />
  <rect x="0" y="0" width="${size}" height="10" fill="${ORANGE}" clip-path="url(#badge-clip)" />
  <image href="${logo}" xlink:href="${logo}" x="190" y="58" width="120" height="120" preserveAspectRatio="xMidYMid meet" />
  <text x="250" y="238" text-anchor="middle" font-family="${FONT}" font-size="46" font-weight="700" letter-spacing="3" fill="${ORANGE}">COLLY</text>
  <text x="250" y="268" text-anchor="middle" font-family="${FONT}" font-size="13" font-weight="600" letter-spacing="3.5" fill="${MUTED}">AGENT CERTIFICATION PROGRAMME</text>
  <line x1="90" y1="300" x2="410" y2="300" stroke="${BORDER}" stroke-width="1.5" />
  <text x="250" y="360" text-anchor="middle" font-family="${FONT}" font-size="${nameFontSize(name)}" font-weight="600" fill="${INK}">${displayName}</text>
  <text x="250" y="416" text-anchor="middle" font-family="${FONT}" font-size="34" font-weight="700" letter-spacing="2" fill="${ORANGE}">CERTIFIED</text>
  <text x="250" y="452" text-anchor="middle" font-family="${FONT}" font-size="18" font-weight="500" letter-spacing="1" fill="${MUTED}">${yearText}</text>
</svg>
`;
}
