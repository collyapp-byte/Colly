"use client";

import Link from "next/link";
import { ArrowRight, TriangleAlert } from "lucide-react";
import { useAgentData } from "@/components/agents/use-agent-data";
import { CourseBadge } from "@/components/agents/course-badge";
import { isCourseSlug } from "@/lib/course-badge-meta";
import type { AgentBadgesResponse, AgentTrainingResponse } from "@/lib/agents-types";

export default function AgentTrainingPage() {
  const { data, error, loading } = useAgentData<AgentTrainingResponse>(
    "/api/agents/training",
  );
  const { data: badgesData } = useAgentData<AgentBadgesResponse>(
    "/api/agents/badges",
  );

  const earnedBadges = new Set(
    (badgesData?.badges ?? [])
      .filter((badge) => badge.earned)
      .map((badge) => badge.courseSlug),
  );

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-7 w-40 animate-pulse rounded bg-gray-200" />
        <div className="h-28 animate-pulse rounded-xl bg-gray-100" />
        <div className="h-28 animate-pulse rounded-xl bg-gray-100" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>{error ?? "We couldn't load the courses."}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl text-gray-900">Training</h1>
        <p className="mt-1 text-sm text-gray-500">
          Work through each course and pass its quiz to become a certified Colly
          agent.
        </p>
      </div>

      {data.courses.length === 0 ? (
        <p className="rounded-xl border border-panel-border bg-white p-5 text-sm text-gray-500">
          No courses are available yet. Check back soon.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {data.courses.map((course) => {
            const percent =
              course.lessonCount > 0
                ? Math.round((course.completedCount / course.lessonCount) * 100)
                : 0;
            const complete = percent === 100;

            return (
              <Link
                key={course.slug}
                href={`/agents/training/${course.slug}`}
                className="group rounded-xl border border-panel-border bg-white p-5 transition-colors hover:border-colly/40"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold text-gray-900">
                      {course.title}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                      {course.description}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-start gap-3">
                    {isCourseSlug(course.slug) &&
                      earnedBadges.has(course.slug) && (
                        <span className="flex flex-col items-center gap-1">
                          <CourseBadge
                            courseSlug={course.slug}
                            earned
                            size="sm"
                          />
                          <span className="text-[11px] font-medium text-success">
                            Certified
                          </span>
                        </span>
                      )}
                    <ArrowRight
                      className="mt-1 h-4 w-4 shrink-0 text-gray-300 transition-colors group-hover:text-colly"
                      aria-hidden
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full transition-all ${
                        complete ? "bg-success" : "bg-colly"
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="text-[13px] font-medium text-gray-500">
                    {complete
                      ? "Completed"
                      : `${course.completedCount} / ${course.lessonCount}`}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
