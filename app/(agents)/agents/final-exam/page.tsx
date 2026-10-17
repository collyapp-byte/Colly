"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AgentFinalExamResponse, AgentFinalExamResult } from "@/lib/agents-types";

const PASS_MARK = 80;

export default function FinalExamPage() {
  const [questions, setQuestions] = useState<AgentFinalExamResponse["questions"]>(
    [],
  );
  const [locked, setLocked] = useState(false);
  const [alreadyPassed, setAlreadyPassed] = useState(false);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AgentFinalExamResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/agents/final-exam", { cache: "no-store" });
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as AgentFinalExamResponse;
        setQuestions(data.questions);
        setLocked(data.locked);
        setAlreadyPassed(data.alreadyPassed);
        setAnswers(Array(data.questions.length).fill(null));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const setAnswer = (idx: number, val: number) => {
    setAnswers((a) => {
      const copy = [...a];
      copy[idx] = val;
      return copy;
    });
  };

  const onSubmit = async () => {
    if (answers.some((a) => a === null)) {
      setError("Answer every question before submitting.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/agents/final-exam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const data = (await res.json()) as Partial<AgentFinalExamResult> & {
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || "Submit failed");
      setResult({
        score: data.score ?? 0,
        passed: data.passed ?? false,
        correct: data.correct ?? 0,
        total: data.total ?? 0,
        certified: data.certified ?? false,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-4 text-sm text-gray-600">Loading final exam...</div>;
  if (locked) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <h1 className="text-xl font-semibold">Final Certification Exam</h1>
        <p className="text-sm text-gray-600">
          You need all four course badges before taking the final exam.
        </p>
        <div className="flex gap-2">
          <Link href="/agents/dashboard" className="rounded bg-gray-200 px-3 py-2 text-sm">
            Back to Dashboard
          </Link>
          <Link href="/agents/training" className="rounded bg-[#FF6600] px-3 py-2 text-sm text-white">
            Go to Training
          </Link>
        </div>
      </div>
    );
  }
  if (alreadyPassed && !result) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <h1 className="text-xl font-semibold">Final Certification Exam</h1>
        <p className="text-sm text-green-700">You already passed the final certification exam.</p>
        <div className="flex gap-2">
          <Link href="/agents/certificate" className="rounded bg-blue-600 px-3 py-2 text-sm text-white">
            View Certificate
          </Link>
          <Link href="/agents/dashboard" className="rounded bg-gray-200 px-3 py-2 text-sm">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }
  if (error && !result) return <div className="p-4 text-sm text-red-600">{error}</div>;
  if (result) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <h1 className="text-xl font-semibold">Final Certification Exam Result</h1>
        <p className="text-sm">
          Score: {result.score}% ({result.correct}/{result.total})
        </p>
        <p className={result.passed ? "text-sm text-green-700" : "text-sm text-amber-700"}>
          {result.passed ? "Passed" : `Failed (need ${PASS_MARK}% or above)`}
        </p>
        {result.passed && (
          <p className="text-xs text-gray-600">
            {result.certified ? "Certificate issued." : "Certificate issuance pending..."}
          </p>
        )}
        <div className="flex gap-2">
          <Link href="/agents/dashboard" className="rounded bg-gray-200 px-3 py-2 text-sm">
            Back to Dashboard
          </Link>
          <Link href="/agents/certificate" className="rounded bg-blue-600 px-3 py-2 text-sm text-white">
            View Certificate
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <h1 className="text-xl font-semibold">Final Certification Exam</h1>
      {questions.map((q, idx) => {
        const opts = Array.isArray(q.options) ? (q.options as string[]) : [];
        return (
          <div key={q.id} className="rounded border border-gray-200 p-4">
            <div className="mb-1 text-xs font-medium text-gray-500">{q.sectionTitle}</div>
            <div className="mb-3 text-sm font-medium">
              Q{q.order}. {q.question}
            </div>
            <div className="flex flex-col gap-2">
              {opts.map((opt, oidx) => (
                <label key={oidx} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={`q-${idx}`}
                    checked={answers[idx] === oidx}
                    onChange={() => setAnswer(idx, oidx)}
                  />
                  <span>{String(opt).replace(/^[A-D]\)\s*/, "")}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
      {error && <div className="text-sm text-red-600">{error}</div>}
      <button
        onClick={onSubmit}
        disabled={submitting}
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {submitting ? "Submitting..." : "Submit Final Exam"}
      </button>
    </div>
  );
}