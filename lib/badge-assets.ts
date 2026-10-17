import { readFile } from "node:fs/promises";
import path from "node:path";
import type { CourseSlug } from "@/lib/course-badge-meta";

/**
 * Helpers for serving the static badge artwork in `public/badges`, shared by the
 * PNG and SVG download routes.
 */

/** Absolute path to the earned-state SVG for a badge-eligible course. */
export function badgeSvgPath(courseSlug: CourseSlug): string {
  return path.join(process.cwd(), "public", "badges", `${courseSlug}.svg`);
}

/** Download headers: attachment filename plus private caching. */
export function badgeDownloadHeaders(
  courseSlug: string,
  ext: "png" | "svg",
): Record<string, string> {
  return {
    "Content-Type": ext === "png" ? "image/png" : "image/svg+xml",
    "Content-Disposition": `attachment; filename="${courseSlug}-badge.${ext}"`,
    "Cache-Control": "private, max-age=3600",
  };
}

/**
 * The Colly logo as a `data:` URI, for embedding in generated badge SVGs and
 * the certificate PDF.
 *
 * Prefers the raster `public/logo.png` produced by `scripts/convert-logo.cjs`
 * and falls back to the vector `public/logo.svg` if the PNG has not been built.
 */
export async function collyLogoDataUri(): Promise<string> {
  const publicDir = path.join(process.cwd(), "public");
  try {
    const png = await readFile(path.join(publicDir, "logo.png"));
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    const svg = await readFile(path.join(publicDir, "logo.svg"));
    return `data:image/svg+xml;base64,${svg.toString("base64")}`;
  }
}

/** Download headers for the certified-agent badge image. */
export function certificationBadgeHeaders(
  agentNumber: string,
  ext: "png" | "svg",
): Record<string, string> {
  return {
    "Content-Type": ext === "png" ? "image/png" : "image/svg+xml",
    "Content-Disposition": `attachment; filename="colly-agent-${agentNumber}-badge.${ext}"`,
    "Cache-Control": "private, max-age=3600",
  };
}
