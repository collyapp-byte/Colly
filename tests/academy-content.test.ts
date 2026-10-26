import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

import { COURSE_BADGE_SLUGS } from "../lib/course-badge-meta";
import { FREE_PLAN_LIMITS, PLANS } from "../lib/plans";

type QuizQuestion = {
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string | null;
};

type Lesson = {
  slug: string;
  title: string;
  order: number;
  durationMin?: number | null;
  bodyMarkdown: string;
};

type Course = {
  slug: string;
  title: string;
  description: string;
  order: number;
  isCertificationCourse?: boolean;
  lessons: Lesson[];
  questions: QuizQuestion[];
};

type ExamRow = QuizQuestion & { order: number; sectionTitle: string };

type AcademyContent = {
  AGENT_COURSES: Course[];
  COURSES: Course[];
  EXTRA_LESSONS: Record<string, Lesson[]>;
  COURSE_QUIZZES: Record<string, QuizQuestion[]>;
  FINAL_EXAM_QUESTIONS: QuizQuestion[];
  FINAL_EXAM_SECTIONS: { start: number; end: number; title: string }[];
  finalExamRows: () => ExamRow[];
};

// The academy content is authored as CommonJS so prisma/seed.cjs can require it.
const require = createRequire(import.meta.url);
const academy = require("../prisma/academy-content.cjs") as AcademyContent;

const money = (amount: number) => amount.toLocaleString("en-US");

const allLessonText = () =>
  academy.AGENT_COURSES.flatMap((course) =>
    course.lessons.map((lesson) => lesson.bodyMarkdown),
  ).join("\n");

test("the four courses cover exactly the four badge-eligible slugs", () => {
  const slugs = academy.AGENT_COURSES.map((course) => course.slug).sort();
  assert.deepEqual(slugs, [...COURSE_BADGE_SLUGS].sort());

  for (const course of academy.AGENT_COURSES) {
    assert.ok(course.title.trim().length > 0);
    assert.ok(course.description.trim().length > 0);
    assert.ok(course.lessons.length >= 5, `${course.slug} needs a full course`);
    assert.ok(course.questions.length >= 8, `${course.slug} needs a full quiz`);
  }
});

test("lesson slugs are unique, ordered 1..n and have real bodies", () => {
  for (const course of academy.AGENT_COURSES) {
    const slugs = course.lessons.map((lesson) => lesson.slug);
    assert.equal(new Set(slugs).size, slugs.length, `${course.slug} duplicate slug`);

    course.lessons.forEach((lesson, index) => {
      assert.equal(lesson.order, index + 1, `${lesson.slug} order must be 1..n`);
      assert.ok(lesson.title.trim().length > 0, `${lesson.slug} needs a title`);
      assert.ok(
        lesson.bodyMarkdown.trim().length > 200,
        `${lesson.slug} body is too short to teach anything`,
      );
      assert.match(lesson.slug, /^[a-z0-9-]+$/, "slugs are url-safe");
    });
  }
});

test("every quiz question is answerable and explains the answer", () => {
  for (const course of academy.AGENT_COURSES) {
    const seen = new Set<string>();

    for (const question of course.questions) {
      assert.ok(question.question.trim().length > 0);
      assert.equal(question.options.length, 4, `${question.question} needs 4 options`);
      assert.equal(
        new Set(question.options).size,
        4,
        `${question.question} has duplicate options`,
      );
      assert.ok(
        Number.isInteger(question.correctIndex) &&
          question.correctIndex >= 0 &&
          question.correctIndex < question.options.length,
        `${question.question} has an invalid correctIndex`,
      );
      assert.ok(
        typeof question.explanation === "string" &&
          question.explanation.trim().length > 20,
        `${question.question} needs an explanation`,
      );
      assert.equal(seen.has(question.question), false, "duplicate question text");
      seen.add(question.question);
    }
  }
});

test("the final exam is 40 questions, 10 per section, all explained", () => {
  const rows = academy.finalExamRows();
  assert.equal(rows.length, 40);
  assert.equal(academy.FINAL_EXAM_QUESTIONS.length, 40);

  const sections = new Map<string, number>();
  const seen = new Set<string>();

  rows.forEach((row, index) => {
    assert.equal(row.order, index + 1);
    assert.ok(row.sectionTitle.trim().length > 0, `question ${row.order} has no section`);
    sections.set(row.sectionTitle, (sections.get(row.sectionTitle) ?? 0) + 1);

    assert.equal(row.options.length, 4);
    assert.ok(row.correctIndex >= 0 && row.correctIndex < 4);
    assert.ok(
      typeof row.explanation === "string" && row.explanation.trim().length > 20,
      `question ${row.order} needs an explanation`,
    );
    assert.equal(seen.has(row.question), false, "duplicate exam question");
    seen.add(row.question);
  });

  assert.deepEqual(
    [...sections.values()],
    [10, 10, 10, 10],
    "each of the four sections must hold ten questions",
  );
  assert.deepEqual(
    [...sections.keys()],
    academy.FINAL_EXAM_SECTIONS.map((section) => section.title),
  );
});

test("the pricing lesson quotes lib/plans.ts exactly", () => {
  const lesson = academy.AGENT_COURSES.flatMap((course) => course.lessons).find(
    (entry) => entry.slug === "what-colly-costs",
  );

  assert.ok(lesson, "the pricing lesson must exist");

  for (const tier of ["green", "blue", "black"] as const) {
    const plan = PLANS[tier];
    assert.ok(
      lesson.bodyMarkdown.includes(
        `₦${money(plan.monthly)}/month — ${money(plan.credits)} credits`,
      ),
      `${tier} must be quoted as ₦${money(plan.monthly)} for ${money(plan.credits)} credits`,
    );
    assert.ok(
      lesson.bodyMarkdown.includes(`${money(plan.baseCredits)} base`),
      `${tier} must show its base grant`,
    );
  }

  assert.ok(
    lesson.bodyMarkdown.includes(`${FREE_PLAN_LIMITS.credits} credits every 30 days`),
    "the Free tier must be quoted as 80 credits every 30 days",
  );
  assert.ok(lesson.bodyMarkdown.includes("5 credits"));
  assert.ok(lesson.bodyMarkdown.includes("80 credits"));
});

test("the curriculum never repeats a retired claim", () => {
  const text = allLessonText();
  const retired = [
    "WhatsApp Business API",
    "44,000 credits",
    "100,000 credits",
    "50 credits every month",
    "within 24 hours",
    "switch on WhatsApp for them",
    "final-exam-questions.txt",
  ];

  for (const claim of retired) {
    assert.equal(text.includes(claim), false, `stale claim found: ${claim}`);
  }
});

test("new product areas are taught", () => {
  const slugs = new Set(
    academy.AGENT_COURSES.flatMap((course) => course.lessons.map((lesson) => lesson.slug)),
  );

  for (const required of [
    "importing-from-jiji",
    "web-chat-embed-and-qr",
    "credits-plans-and-top-ups",
    "weekly-report-and-owner-alerts",
    "crm-pipeline-and-deal-status",
    "agent-commission-and-payouts",
    "channels-and-credits-at-a-glance",
  ]) {
    assert.ok(slugs.has(required), `missing lesson: ${required}`);
  }
});

