/**
 * Presentation metadata for the four badge-eligible agent courses: labels and
 * accent colours. Shared by the server award logic (lib/badges.ts) and the
 * client badge components, so keep this file free of server-only imports
 * (Prisma, Node APIs).
 */

export const COURSE_BADGES = {
  "understanding-colly": { label: "Understanding Colly", color: "#1E3A8A" },
  "setting-up-a-business": { label: "Setting Up a Business", color: "#FF6600" },
  "training-the-owner": { label: "Training the Owner", color: "#10B981" },
  "sales-and-support": { label: "Sales & Support", color: "#7C3AED" },
} as const;

export type CourseSlug = keyof typeof COURSE_BADGES;

/** Badge order used wherever the full set is listed (dashboard, APIs). */
export const COURSE_BADGE_SLUGS = Object.keys(
  COURSE_BADGES,
) as CourseSlug[];

/** Manual two-line breaks so short hexagon faces never clip the label. */
export const COURSE_BADGE_LABEL_LINES: Record<CourseSlug, string[]> = {
  "understanding-colly": ["Understanding", "Colly"],
  "setting-up-a-business": ["Setting Up", "A Business"],
  "training-the-owner": ["Training", "The Owner"],
  "sales-and-support": ["Sales & Support"],
};

export function isCourseSlug(value: string): value is CourseSlug {
  return Object.prototype.hasOwnProperty.call(COURSE_BADGES, value);
}
