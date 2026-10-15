"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CircleAlert,
  CircleCheck,
  LoaderCircle,
} from "lucide-react";
import { useAgentData } from "@/components/agents/use-agent-data";
import type { AgentCourseResponse, AgentQuizResult } from "@/lib/agents-types";

const PASS_MARK = 80;

export default function AgentQuizPage() {
  return (
    <Suspense fallback={<QuizFallback />}>
      <QuizDetail />
    </Suspense>
  );
}

function QuizDetail() {
  const { courseSlug } = useParams<{ courseSlug: string }>();
  const { data, error, loading } = useAgentData<AgentCourseResponse>(
    `/api/agents/training/${courseSlug}`,
  );

  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<AgentQuizResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  const allAnswered = questions.every((question) => answers[question.id] !== undefined);

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/agents/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseSlug,
          answers: questions.map((question) => answers[question.id]),
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | (AgentQuizResult & { error?: string })
        | null;

      if (!response.ok || !payload) {
        throw new Error(payload?.error ?? "We couldn't submit your quiz.");
      }

      setResult(payload);
    } catch (cause) {
      setSubmitError(
        cause instanceof Error ? cause.message : "Something went wrong.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  // Result view
  if (result) {
    const passed = result.passed;
    return (
      <div className="mx-auto w-full max-w-2xl">
        {backToCourse}
        <div className="rounded-xl border border-panel-border bg-white p-6 text-center">
          <div
            className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${
              passed ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
            }`}
          >
            {passed ? (
              <CircleCheck className="h-7 w-7" aria-hidden />
            ) : (
              <CircleAlert className="h-7 w-7" aria-hidden />
            )}
          </div>

          <h1 className="mt-4 font-display text-2xl text-gray-900">
            {passed ? "You passed" : "Not quite yet"}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            You scored <span className="font-semibold text-gray-700">{result.score}%</span>.
            The pass mark is {PASS_MARK}%.
          </p>

          {passed && result.certified ? (
            <p className="mt-3 text-sm text-success">
              You are now a certified Colly agent.
            </p>
          ) : passed ? (
            <p className="mt-3 text-sm text-gray-500">
              Pass the quiz in every course to earn your certificate.
            </p>
          ) : null}

          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {passed ? (
              <Link
                href="/agents/certificate"
                className="inline-flex items-center justify-center rounded-lg bg-[#FF6600] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#E65C00]"
              >
                View certificate
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setAnswers({});
                }}
                className="inline-flex items-center justify-center rounded-lg bg-[#FF6600] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#E65C00]"
              >
                Try again
              </button>
            )}
            <Link
              href={`/agents/training/${courseSlug}`}
              className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Back to course
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      {backToCourse}

      <div className="rounded-xl border border-panel-border bg-white p-5 sm:p-6">
        <h1 className="font-display text-2xl text-gray-900">
          {course.title} — Quiz
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Answer all {questions.length} questions. You need {PASS_MARK}% or more
          to pass.
        </p>

        <ol className="mt-6 flex flex-col gap-6">
          {questions.map((question, index) => (
            <li key={question.id}>
              <p className="text-sm font-medium text-gray-900">
                {index + 1}. {question.question}
              </p>
              <div className="mt-3 flex flex-col gap-2">
                {question.options.map((option, optionIndex) => {
                  const selected = answers[question.id] === optionIndex;
                  return (
                    <label
                      key={optionIndex}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-2.5 text-sm transition-colors ${
                        selected
                          ? "border-colly bg-colly-light text-gray-900"
                          : "border-gray-200 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`question-${question.id}`}
                        checked={selected}
                        onChange={() =>
                          setAnswers((prev) => ({
                            ...prev,
                            [question.id]: optionIndex,
                          }))
                        }
                        className="h-4 w-4 accent-[#FF6600]"
                      />
                      <span>{option}</span>
                    </label>
                  );
                })}
              </div>
            </li>
          ))}
        </ol>

        {submitError && (
          <div className="mt-6 flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>{submitError}</p>
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!allAnswered || submitting}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#FF6600] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#E65C00] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting && (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
          )}
          Submit answers
        </button>
      </div>
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
