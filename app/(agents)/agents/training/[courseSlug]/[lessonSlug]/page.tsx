"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";
import { useAgentData } from "@/components/agents/use-agent-data";
import type { AgentLessonResponse } from "@/lib/agents-types";

/** Turns a YouTube URL (watch, youtu.be or embed) into a privacy-enhanced embed. */
function toEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    let id: string | null = null;

    if (host === "youtu.be") {
      id = parsed.pathname.slice(1);
    } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (parsed.pathname.startsWith("/embed/")) {
        id = parsed.pathname.replace("/embed/", "");
      } else {
        id = parsed.searchParams.get("v");
      }
    }

    return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  } catch {
    return null;
  }
}

export default function AgentLessonPage() {
  return (
    <Suspense fallback={<LessonFallback />}>
      <LessonDetail />
    </Suspense>
  );
}

function LessonDetail() {
  const { courseSlug, lessonSlug } = useParams<{
    courseSlug: string;
    lessonSlug: string;
  }>();
  const router = useRouter();

  const { data, error, loading } = useAgentData<AgentLessonResponse>(
    `/api/agents/training/${courseSlug}/${lessonSlug}`,
  );

  const [justCompleted, setJustCompleted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const backToCourse = (
    <Link
      href={`/agents/training/${courseSlug}`}
      className="mb-4 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Back to course
    </Link>
  );

  if (loading) return <LessonFallback />;

  if (error || !data) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        {backToCourse}
        <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{error ?? "We couldn't load this lesson."}</p>
        </div>
      </div>
    );
  }

  const { lesson, prevSlug, nextSlug } = data;
  const completed = lesson.completed || justCompleted;
  const embedUrl = lesson.youtubeUrl ? toEmbedUrl(lesson.youtubeUrl) : null;

  async function handleComplete(next: string | null) {
    setSaving(true);
    setSaveError(null);

    try {
      const response = await fetch(`/api/agents/lessons/${lesson.id}/complete`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("We couldn't save your progress. Please try again.");
      }

      setJustCompleted(true);

      if (next) {
        router.push(`/agents/training/${courseSlug}/${next}`);
      } else {
        router.push(`/agents/training/${courseSlug}`);
      }
    } catch (cause) {
      setSaveError(
        cause instanceof Error ? cause.message : "Something went wrong.",
      );
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      {backToCourse}

      <div className="rounded-xl border border-panel-border bg-white p-5 sm:p-6">
        <h1 className="font-display text-2xl text-gray-900">{lesson.title}</h1>
        {lesson.durationMin !== null && (
          <p className="mt-1 text-[13px] text-gray-400">
            {lesson.durationMin} min read
          </p>
        )}

        {embedUrl && (
          <div className="mt-5 aspect-video w-full overflow-hidden rounded-lg border border-gray-200">
            <iframe
              src={embedUrl}
              title={lesson.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
            />
          </div>
        )}

        <div className="agent-markdown mt-6">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {lesson.bodyMarkdown}
          </ReactMarkdown>
        </div>
      </div>

      {saveError && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{saveError}</p>
        </div>
      )}

      {/* Lesson navigation */}
      <div className="mt-5 flex items-center justify-between gap-3">
        <div>
          {prevSlug && (
            <Link
              href={`/agents/training/${courseSlug}/${prevSlug}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Previous
            </Link>
          )}
        </div>

        <div className="flex items-center gap-3">
          {completed ? (
            <>
              <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-success">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                Completed
              </span>
              {nextSlug && (
                <Link
                  href={`/agents/training/${courseSlug}/${nextSlug}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#FF6600] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#E65C00]"
                >
                  Next lesson
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={() => handleComplete(nextSlug)}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-[#FF6600] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#E65C00] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving && (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden />
              )}
              {nextSlug ? "Mark complete & continue" : "Mark as complete"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function LessonFallback() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-4 h-4 w-32 animate-pulse rounded bg-gray-200" />
      <div className="h-[420px] animate-pulse rounded-xl bg-gray-100" />
    </div>
  );
}
