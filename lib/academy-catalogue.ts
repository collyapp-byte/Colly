/**
 * Public summary of the four agent-academy courses.
 *
 * The full source of truth — lesson bodies, quiz questions, explanations and
 * the 40-question final exam — lives in `prisma/academy-content.cjs`, which the
 * seed and `npm run academy:sync` read. This module only carries the bits the
 * public `/academy` landing page (and its JSON-LD) may show without a session.
 *
 * `tests/seo.test.ts` asserts every title, summary, lesson count and slug here
 * still matches that content file, so the marketing page can never advertise a
 * course the academy does not teach.
 */

import type { CourseSlug } from "@/lib/course-badge-meta";

export type AcademyCourseSummary = {
  /** Also the badge slug / route segment under `/agents/training`. */
  slug: CourseSlug;
  title: string;
  summary: string;
  lessonCount: number;
};

export const ACADEMY_COURSES: readonly AcademyCourseSummary[] = [
  {
    slug: "understanding-colly",
    title: "Understanding Colly",
    summary:
      "The foundations. What Colly is, what it does, what it costs, and what it cannot do. Every agent must complete this before touching a customer.",
    lessonCount: 7,
  },
  {
    slug: "setting-up-a-business",
    title: "Setting Up a Business",
    summary:
      "The hands-on setup. From first meeting to final handoff. Every step an agent takes to onboard a new business.",
    lessonCount: 9,
  },
  {
    slug: "training-the-owner",
    title: "Training the Owner",
    summary:
      "After setup, teach the owner to use the dashboard, handle takeover, and fix common AI mistakes.",
    lessonCount: 7,
  },
  {
    slug: "sales-and-support",
    title: "Sales & Support",
    summary:
      "How to sell and support Colly: find businesses that need it, pitch confidently, set your setup fee, get paid, and keep your first customers.",
    lessonCount: 10,
  },
];

/** Total lesson count across the programme (shown on the landing page). */
export const ACADEMY_LESSON_COUNT = ACADEMY_COURSES.reduce(
  (total, course) => total + course.lessonCount,
  0,
);

/**
 * Partner-programme facts the public page states. They mirror the rules the
 * code enforces, so they live here (and `tests/seo.test.ts` checks the exam
 * against the content file) instead of being typed into JSX:
 *
 * - `QUIZ_PASS_MARK`: lib/badges.ts awards a course badge only at 80% or above.
 * - `FINAL_EXAM_QUESTION_COUNT`: the 40-question exam in
 *   `prisma/academy-content.cjs` (10 per course section).
 * - `AGENT_COMMISSION_PERCENT` / `AGENT_COMMISSION_MONTHS`: the
 *   `referredByAgentId` / `commissionEndsAt` window credited by the billing
 *   webhook.
 * - `AGENT_PAYOUT_MINIMUM_NAIRA`: `PAYOUT_MIN_NAIRA` in
 *   app/api/agents/payouts/request/route.ts.
 */
export const QUIZ_PASS_MARK = 80;
export const FINAL_EXAM_QUESTION_COUNT = 40;
export const AGENT_COMMISSION_PERCENT = 15;
export const AGENT_COMMISSION_MONTHS = 12;
export const AGENT_PAYOUT_MINIMUM_NAIRA = 5_000;

