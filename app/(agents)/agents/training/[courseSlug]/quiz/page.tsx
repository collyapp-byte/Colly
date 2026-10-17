"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  CircleCheck,
  CircleX,
  LoaderCircle,
} from "lucide-react";
import { useAgentData, revalidateAgentData } from "@/components/agents/use-agent-data";
import type {
  AgentCourseResponse,
  AgentQuizQuestion,
  AgentQuizResult,
} from "@/lib/agents-types";

/** A quiz passes at 80% or above. */
const PASS_MARK = 80;

/** Renders a percentage without a trailing ".0" (e.g. 87.5, 90, 100). */
function formatPercent(value: number): string {
  return `${Math.round(value * 10) / 10}`;
}

export default function AgentQuizPage() {
  return (
    <Suspense fallback={<QuizFallback />}>
      <QuizDetail />
    </Suspense>
  );
}

/**
 * The course slug comes from the URL, which isn't known while the route is
 * prerendered, so this read happens inside the Suspense boundary above.
 */
function QuizDetail() {
  const { courseSlug } = useParams<{ courseSlug: string }>();
  const { data, error, loading } = useAgentData<AgentCourseResponse>(
    `/api/agents/training/${courseSlug}`,
  );

  const backToCourse = (
    <Link
      href={`/agents/training/${courseSlug}`}
      className="mb-4 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Back to course
    </Link>
  );

  if (loading) return <QuizFallback />;

  if (error || !data) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        {backToCourse}
        <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{error ?? "We couldn't load the quiz."}</p>
        </div>
      </div>
    );
  }

  const { course, questions, quizAvailable } = data;

  if (!quizAvailable) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        {backToCourse}
        <div className="rounded-xl border border-panel-border bg-white p-6 text-sm text-gray-500">
          This quiz is not available yet. Finish every lesson in the course first.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      {backToCourse}
      <QuizRunner
        key={courseSlug}
        courseSlug={courseSlug}
        course={course}
        questions={questions}
      />
    </div>
  );
}

/**
 * One question at a time. Selecting an option locks the answer and reveals
 * immediate feedback; "Next" advances, and the final question submits the whole
 * answer set to the grading route.
 */
function QuizRunner({
  courseSlug,
  course,
  questions,
}: {
  courseSlug: string;
  course: AgentCourseResponse["course"];
  questions: AgentQuizQuestion[];
}) {
  const total = questions.length;
  const [answers, setAnswers] = useState<(number | null)[]>(() =>
    questions.map(() => null),
  );
  const [current, setCurrent] = useState(0);
  const [result, setResult] = useState<AgentQuizResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const question = questions[current];
  const selected = answers[current] ?? null;
  const locked = selected !== null;
  const isLast = current === total - 1;

  const correctCount = questions.reduce(
    (count, item, index) =>
      answers[index] === item.correctIndex ? count + 1 : count,
    0,
  );
  const percent = total > 0 ? (correctCount / total) * 100 : 0;

  function handleSelect(optionIndex: number) {
    if (locked) return;
    setAnswers((prev) => {
      const next = [...prev];
      next[current] = optionIndex;
      return next;
    });
  }

  function handleNext() {
    if (!locked || submitting) return;
    if (!isLast) {
      setCurrent((value) => value + 1);
      return;
    }
    void handleSubmit();
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/agents/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseSlug,
          answers: questions.map((_, index) => answers[index]),
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | (AgentQuizResult & { error?: string })
        | null;

      if (!response.ok || !payload) {
        throw new Error(payload?.error ?? "We couldn't submit your quiz.");
      }

      setResult(payload);
      if (payload.passed) {
        // A pass may have just awarded the course badge server-side. Refresh
        // any mounted badge/progress views so it appears without a page reload.
        revalidateAgentData();
      }
    } catch (cause) {
      setSubmitError(
        cause instanceof Error ? cause.message : "Something went wrong.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleRetry() {
    setResult(null);
    setSubmitError(null);
    setAnswers(questions.map(() => null));
    setCurrent(0);
  }

  // Result view
  if (result) {
    const passed = result.passed;
    const missed = questions
      .map((item, index) =>
        answers[index] === item.correctIndex ? null : `Q${index + 1}`,
      )
      .filter((value): value is string => value !== null);

    return (
      <div
        className={`rounded-xl border p-6 text-center ${
          passed ? "border-success/30 bg-success/5" : "border-danger/30 bg-danger/5"
        }`}
      >
        {!passed && (
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-danger">
            <CircleAlert className="h-7 w-7" aria-hidden />
          </div>
        )}

        <h1 className="mt-4 font-display text-2xl text-gray-900">
          {passed ? "Passed!" : "Not passed"}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          <span className="font-semibold text-gray-800">
            {correctCount}/{total} ({formatPercent(percent)}%)
          </span>
          . The pass mark is {PASS_MARK}%.
        </p>

        {passed ? (
          result.certified ? (
            <p className="mt-3 text-sm text-success">
              You are now a certified Colly agent.
            </p>
          ) : (
            <p className="mt-3 text-sm text-gray-500">
              Pass the quiz in every course to earn your certificate.
            </p>
          )
        ) : (
          <p className="mt-3 text-sm text-gray-600">
            Missed:{" "}
            <span className="font-medium text-gray-800">
              {missed.length > 0 ? missed.join(", ") : "—"}
            </span>
          </p>
        )}

        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {passed ? (
            result.certified ? (
              <Link
                href="/agents/certificate"
                className="inline-flex items-center justify-center rounded-lg bg-[#FF6600] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#E65C00]"
              >
                View certificate
              </Link>
            ) : (
              <Link
                href="/agents/training"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#FF6600] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#E65C00]"
              >
                Continue to next course
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            )
          ) : (
            <button
              type="button"
              onClick={handleRetry}
              className="inline-flex items-center justify-center rounded-lg bg-[#FF6600] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#E65C00]"
            >
              Retry quiz
            </button>
          )}
          <Link
            href="/agents/training"
            className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Back to training
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-panel-border bg-white p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="font-display text-xl text-gray-900">
          {course.title} — Quiz
        </h1>
        <span className="shrink-0 text-[13px] font-medium text-gray-400">
          Question {current + 1} of {total}
        </span>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full bg-colly transition-all"
          style={{ width: `${((current + (locked ? 1 : 0)) / total) * 100}%` }}
        />
      </div>

      <p className="mt-5 text-base font-medium text-gray-900">
        {question.question}
      </p>

      <div className="mt-4 flex flex-col gap-2" role="radiogroup">
        {question.options.map((option, optionIndex) => {
          const isCorrect = optionIndex === question.correctIndex;
          const isChosen = optionIndex === selected;

          let stateClass = "border-gray-200 text-gray-700 hover:bg-gray-50";
          let icon = null;

          if (locked) {
            if (isCorrect) {
              stateClass = "border-success bg-success/5 text-gray-900";
              icon = (
                <CircleCheck className="h-5 w-5 shrink-0 text-success" aria-hidden />
              );
            } else if (isChosen) {
              stateClass = "border-danger bg-danger/5 text-gray-900";
              icon = (
                <CircleX className="h-5 w-5 shrink-0 text-danger" aria-hidden />
              );
            } else {
              stateClass = "border-gray-200 text-gray-400 opacity-50";
            }
          }

          return (
            <button
              key={optionIndex}
              type="button"
              role="radio"
              aria-checked={isChosen}
              disabled={locked}
              onClick={() => handleSelect(optionIndex)}
              className={`flex w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                locked ? "cursor-default" : "cursor-pointer"
              } ${stateClass}`}
            >
              <span>{option}</span>
              {icon}
            </button>
          );
        })}
      </div>

      {locked && selected !== question.correctIndex && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          {question.explanation && question.explanation.trim().length > 0
            ? question.explanation
            : "The correct answer is highlighted above."}
        </div>
      )}

      {submitError && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{submitError}</p>
        </div>
      )}

      {locked && (
        <button
          type="button"
          onClick={handleNext}
          disabled={submitting}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#FF6600] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#E65C00] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting && (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
          )}
          {isLast ? "Finish" : "Next"}
          {!submitting && <ArrowRight className="h-4 w-4" aria-hidden />}
        </button>
      )}
    </div>
  );
}

function QuizFallback() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-4 h-4 w-32 animate-pulse rounded bg-gray-200" />
      <div className="h-[480px] animate-pulse rounded-xl bg-gray-100" />
    </div>
  );
}
