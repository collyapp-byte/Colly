"use client";

import { Lock } from "lucide-react";
import {
  COURSE_BADGES,
  COURSE_BADGE_LABEL_LINES,
  type CourseSlug,
} from "@/lib/course-badge-meta";
import { COLLY_LOGO_PATHS, collyLogoTransform } from "@/lib/colly-logo-mark";

/** Hexagonal course badge. Earned badges show in the course accent colour;
 * unearned ones are greyed out with a lock overlay. */
type CourseBadgeProps = {
  courseSlug: CourseSlug;
  earned: boolean;
  size?: "sm" | "md" | "lg";
};

const SIZE_PX = { sm: 64, md: 96, lg: 140 } as const;

const FONT_PX = {
  sm: { certified: 8, label: 6, year: 5 },
  md: { certified: 11, label: 8, year: 7 },
  lg: { certified: 16, label: 12, year: 10 },
} as const;

const LOCK_PX = { sm: 14, md: 18, lg: 24 } as const;

const LOCKED_FILL = "#F3F4F6";
const LOCKED_ACCENT = "#9CA3AF";
const CERTIFIED_COLOR = "#111827";
const LABEL_COLOR = "#6B7280";

const HEX_PATH = "M50 3 L93 28 L93 72 L50 97 L7 72 L7 28 Z";
/** Bounding box the old top chevron occupied; the logo mark is sized to it. */
const LOGO_SIZE = 16;
const LOGO_CENTER_X = 50;
const LOGO_CENTER_Y = 17.5;

export function CourseBadge({
  courseSlug,
  earned,
  size = "md",
}: CourseBadgeProps) {
  const { label, color } = COURSE_BADGES[courseSlug];
  const labelLines = COURSE_BADGE_LABEL_LINES[courseSlug];
  const px = SIZE_PX[size];
  const fonts = FONT_PX[size];
  const accent = earned ? color : LOCKED_ACCENT;
  const fill = earned ? "#FFFFFF" : LOCKED_FILL;
  const certifiedColor = earned ? CERTIFIED_COLOR : LOCKED_ACCENT;
  // The viewBox is 100 user units rendered at `px`; scale rendered font sizes
  // into user units so they land at the intended pixel size.
  const scale = 100 / px;
  const year = new Date().getFullYear();

  const labelYs = labelLines.length === 2 ? [54, 64] : [59];

  return (
    <span
      className={`relative inline-flex ${earned ? "" : "opacity-80"}`}
      style={{ width: px, height: px }}
      role="img"
      aria-label={
        earned
          ? `${label} course badge, certified`
          : `${label} course badge, not yet earned`
      }
    >
      <svg viewBox="0 0 100 100" width={px} height={px} aria-hidden>
        {/* Hexagonal crest, pointed top */}
        <path
          d={HEX_PATH}
          fill={fill}
          stroke={accent}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {/* Colly logo mark, in the footprint the chevron used to occupy */}
        <g transform={collyLogoTransform(LOGO_SIZE, LOGO_CENTER_X, LOGO_CENTER_Y)}>
          {COLLY_LOGO_PATHS.map((logoPath) => (
            <path key={logoPath.id} d={logoPath.d} fill={logoPath.fill} />
          ))}
        </g>

        <text
          x="50"
          y="42"
          textAnchor="middle"
          fill={certifiedColor}
          fontSize={fonts.certified * scale}
          fontWeight={700}
          letterSpacing={0.8 * scale}
        >
          CERTIFIED
        </text>

        {labelLines.map((line, index) => (
          <text
            key={line}
            x="50"
            y={labelYs[index]}
            textAnchor="middle"
            fill={LABEL_COLOR}
            fontSize={fonts.label * scale}
            fontWeight={500}
          >
            {line}
          </text>
        ))}

        {earned && (
          <text
            x="50"
            y="76"
            textAnchor="middle"
            fill={LABEL_COLOR}
            fontSize={fonts.year * scale}
            fontWeight={500}
          >
            {year}
          </text>
        )}
      </svg>

      {!earned && (
        <Lock
          className="absolute bottom-[8%] left-1/2 -translate-x-1/2 text-gray-400"
          size={LOCK_PX[size]}
          aria-hidden
        />
      )}
    </span>
  );
}
