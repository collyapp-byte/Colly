"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Lock,
  TriangleAlert,
} from "lucide-react";
import { useAgentData } from "@/components/agents/use-agent-data";
import type { AgentCourseResponse } from "@/lib/agents-types";

export default function AgentCoursePage() {
  return (
    <Suspense fallback={<CourseFallback />}>
      <CourseDetail />
    </Suspense>
  );
}

/**
 * The course slug comes from the URL, which isn't known while the route is
 * prerendered, so this read happens inside the Suspense boundary above.
 */
function CourseDetail() {
  const { courseSlug } = useParams<{ courseSlug: string }>();
  const { data, error, loading } = useAgentData<AgentCourseResponse>(
    `/api/agents/training/${courseSlug}`,
  );

  const backLink = (
    <Link
      href="/agents/training"
      className="mb-4 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Back to Training
    </Link>
  );

  if (loading) return <CourseFallback />;

  if (error || !data) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        {backLink}
        <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{error ?? "We couldn't load this course."}</p>
        </div>
      </div>
    );
  }

  const { course, lessons, allLessonsComplete, quizAvailable } = data;
  const completedCount = lessons.filter((lesson) => lesson.completed).length;

  return (
    <div className="mx-auto w-full max-w-3xl">
      {backLink}

      <div className="rounded-xl border border-panel-border bg-white p-5">
        <h1 className="font-display text-2xl text-gray-900">{course.title}</h1>
        <p className="mt-1 text-sm text-gray-500">{course.description}</p>
        <p className="mt-3 text-[13px] font-medium text-gray-400">
          {completedCount} of {lessons.length} lessons complete
        </p>
      </div>

      <ul className="mt-4 overflow-hidden rounded-xl border border-panel-border bg-white">
        {lessons.map((lesson) => (
          <li
            key={lesson.id}
            className="border-b border-gray-100 last:border-b-0"
          >
            <Link
              href={`/agents/training/${course.slug}/${lesson.slug}`}
              className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-gray-50 sm:px-5"
            >
              {lesson.completed ? (
                <CheckCircle2
                  className="h-5 w-5 shrink-0 text-success"
                  aria-hidden
                />
              ) : (
                <Circle className="h-5 w-5 shrink-0 text-gray-300" aria-hidden />
              )}
              <span className="flex-1 text-sm font-medium text-gray-800">
                {lesson.title}
              </span>
              {lesson.durationMin !== null && (
                <span className="shrink-0 text-[13px] text-gray-400">
                  {lesson.durationMin} min
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>

      {/* Quiz gate */}
      <div className="mt-5 rounded-xl border border-panel-border bg-white p-5">
        {quizAvailable ? (
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Course quiz
              </h2>
              <p className="mt-0.5 text-[13px] text-gray-500">
                You have finished every lesson. Pass the quiz with 80% or more.
              </p>
            </div>
            <Link
              href={`/agents/training/${course.slug}/quiz`}
              className="inline-flex items-center justify-center rounded-lg bg-[#FF6600] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#E65C00]"
            >
              Take the quiz
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-[13px] text-gray-500">
            <Lock className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
            <p>
              {allLessonsComplete
                ? "There's no quiz for this course yet."
                : "Finish all the lessons to unlock the course quiz."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function CourseFallback() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-4 h-4 w-32 animate-pulse rounded bg-gray-200" />
      <div className="h-32 animate-pulse rounded-xl bg-gray-100" />
      <div className="mt-4 h-64 animate-pulse rounded-xl bg-gray-100" />
    </div>
  );
}
