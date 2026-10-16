import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  COURSE_BADGE_LABEL_LINES,
  COURSE_BADGE_SLUGS,
  COURSE_BADGES,
  isCourseSlug,
  type CourseSlug,
} from "@/lib/course-badge-meta";

export { COURSE_BADGES, COURSE_BADGE_SLUGS, COURSE_BADGE_LABEL_LINES };
export type { CourseSlug };

export type BadgeAwardResult = {
  awarded: boolean;
  alreadyOwned: boolean;
};

/**
 * Awards the course badge when the agent has completed every lesson in the
 * course AND passed the course quiz. Idempotent: an already-earned badge is
 * left untouched and reported via `alreadyOwned`. A badge for an unknown slug
 * is a no-op.
 */
export async function awardBadgeIfEligible(
  agentId: string,
  courseSlug: string,
): Promise<BadgeAwardResult> {
  if (!isCourseSlug(courseSlug)) {
    return { awarded: false, alreadyOwned: false };
  }
  const slug: CourseSlug = courseSlug;

  const existing = await prisma.agentBadge.findUnique({
    where: { agentId_courseSlug: { agentId, courseSlug: slug } },
    select: { id: true },
  });
  if (existing) return { awarded: false, alreadyOwned: true };

  const [course, progressCount, passedAttempts] = await Promise.all([
    prisma.agentCourse.findUnique({
      where: { slug, published: true },
      select: { lessons: { select: { id: true } } },
    }),
    prisma.agentLessonProgress.count({
      where: { agentId, lesson: { course: { slug, published: true } } },
    }),
    prisma.agentQuizAttempt.count({
      where: { agentId, passed: true, course: { slug, published: true } },
    }),
  ]);

  if (!course) return { awarded: false, alreadyOwned: false };

  const allLessonsComplete = progressCount >= course.lessons.length;
  const quizPassed = passedAttempts > 0;

  if (!allLessonsComplete || !quizPassed) {
    return { awarded: false, alreadyOwned: false };
  }

  try {
    await prisma.agentBadge.create({
      data: { agentId, courseSlug: slug },
    });
  } catch (error) {
    // Two concurrent submissions can both clear the pre-check above and race to
    // insert. The unique (agentId, courseSlug) constraint rejects the loser with
    // P2002; treat it as "already owned" instead of failing the request.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { awarded: false, alreadyOwned: true };
    }
    throw error;
  }

  return { awarded: true, alreadyOwned: false };
}

/**
 * True when the agent holds a badge for every one of the four badge-eligible
 * courses (i.e. the Final Certification Exam is unlocked).
 */
export async function hasAllBadges(agentId: string): Promise<boolean> {
  const count = await prisma.agentBadge.count({
    where: { agentId, courseSlug: { in: [...COURSE_BADGE_SLUGS] } },
  });
  return count >= COURSE_BADGE_SLUGS.length;
}

/**
 * The full badge set for the agent (all four courses), each with its earned
 * state and earned timestamp (null when not yet earned).
 */
export async function getAgentBadges(
  agentId: string,
): Promise<
  { courseSlug: CourseSlug; earned: boolean; earnedAt: Date | null }[]
> {
  const rows = await prisma.agentBadge.findMany({
    where: { agentId, courseSlug: { in: [...COURSE_BADGE_SLUGS] } },
    select: { courseSlug: true, earnedAt: true },
  });

  const bySlug = new Map(rows.map((row) => [row.courseSlug, row.earnedAt]));

  return COURSE_BADGE_SLUGS.map((slug) => ({
    courseSlug: slug,
    earned: bySlug.has(slug),
    earnedAt: bySlug.get(slug) ?? null,
  }));
}
