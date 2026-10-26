/* eslint-disable @typescript-eslint/no-require-imports */
// Content-only academy sync.
//
// Applies prisma/academy-content.cjs to the database WITHOUT the destructive
// demo reset in prisma/seed.cjs: businesses, customers, conversations, agents,
// lesson progress and quiz attempts are all left alone.
//
// Use it to ship a curriculum change to production:
//
//   npm run academy:sync
//
// Lessons are upserted by (courseId, slug) so existing lesson ids -- and the
// AgentLessonProgress rows that point at them -- survive. Quiz questions and the
// final exam have no natural key, so they are replaced.

require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const {
  AGENT_COURSES,
  finalExamRows,
} = require("../prisma/academy-content.cjs");

const prisma = new PrismaClient();

/** Course slugs that were renamed; their rows would otherwise linger. */
const RETIRED_COURSE_SLUGS = ["setting-up-whatsapp-ai", "nigerian-sme-sales"];

async function upsertCourse(course) {
  const record = await prisma.agentCourse.upsert({
    where: { slug: course.slug },
    update: {
      title: course.title,
      description: course.description,
      order: course.order,
      published: true,
      isCertificationCourse: course.isCertificationCourse ?? false,
    },
    create: {
      slug: course.slug,
      title: course.title,
      description: course.description,
      order: course.order,
      published: true,
      isCertificationCourse: course.isCertificationCourse ?? false,
    },
  });

  for (const lesson of course.lessons) {
    await prisma.agentLesson.upsert({
      where: { courseId_slug: { courseId: record.id, slug: lesson.slug } },
      update: {
        title: lesson.title,
        order: lesson.order,
        bodyMarkdown: lesson.bodyMarkdown,
        youtubeUrl: lesson.youtubeUrl ?? null,
        durationMin: lesson.durationMin ?? null,
      },
      create: {
        courseId: record.id,
        slug: lesson.slug,
        title: lesson.title,
        order: lesson.order,
        bodyMarkdown: lesson.bodyMarkdown,
        youtubeUrl: lesson.youtubeUrl ?? null,
        durationMin: lesson.durationMin ?? null,
      },
    });
  }

  await prisma.agentQuizQuestion.deleteMany({ where: { courseId: record.id } });
  await prisma.agentQuizQuestion.createMany({
    data: course.questions.map((question, index) => ({
      courseId: record.id,
      order: index + 1,
      question: question.question,
      options: question.options,
      correctIndex: question.correctIndex,
      explanation: question.explanation ?? null,
    })),
  });

  return { lessons: course.lessons.length, questions: course.questions.length };
}

async function main() {
  await prisma.agentCourse.deleteMany({
    where: { slug: { in: RETIRED_COURSE_SLUGS } },
  });

  let lessonCount = 0;
  let questionCount = 0;

  for (const course of AGENT_COURSES) {
    const counts = await upsertCourse(course);
    lessonCount += counts.lessons;
    questionCount += counts.questions;
  }

  const exam = finalExamRows();
  await prisma.agentFinalExamQuestion.deleteMany({});
  await prisma.agentFinalExamQuestion.createMany({ data: exam });

  console.log(
    `Synced ${AGENT_COURSES.length} courses, ${lessonCount} lessons, ${questionCount} quiz questions and ${exam.length} final-exam questions.`,
  );
  console.log("Businesses, agents and progress were not modified.");
}

main()
  .catch((error) => {
    console.error("Academy sync failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
