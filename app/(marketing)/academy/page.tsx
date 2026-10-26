import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, BookOpen, GraduationCap, Wallet } from "lucide-react";
import { JsonLd } from "@/components/seo/json-ld";
import { academyJsonLd, pageMetadata } from "@/lib/seo";
import { formatNaira } from "@/lib/format";
import {
  ACADEMY_COURSES,
  ACADEMY_LESSON_COUNT,
  AGENT_COMMISSION_MONTHS,
  AGENT_COMMISSION_PERCENT,
  AGENT_PAYOUT_MINIMUM_NAIRA,
  FINAL_EXAM_QUESTION_COUNT,
  QUIZ_PASS_MARK,
} from "@/lib/academy-catalogue";

export const metadata: Metadata = pageMetadata({
  title: "Agent Academy",
  description: `The free Colly Agent Academy: ${ACADEMY_COURSES.length} courses and ${ACADEMY_LESSON_COUNT} lessons that teach you how Colly works, how to set a business up on it, how to train the owner and how to sell it. Earn a badge per course, then pass the ${FINAL_EXAM_QUESTION_COUNT}-question final exam for a verifiable certificate.`,
  path: "/academy",
  keywords: [
    "Colly agent programme",
    "become a sales agent Nigeria",
    "AI reseller Nigeria",
    "Colly academy",
    "resell AI software Nigeria",
  ],
});

const PAYOUT_MINIMUM = formatNaira(AGENT_PAYOUT_MINIMUM_NAIRA);

export default function AcademyPage() {
  return (
    <>
      <JsonLd data={academyJsonLd()} />

      <section className="pt-12 pb-4 sm:pt-16">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF6600]">
            Colly Agent Academy
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Become a certified Colly agent
          </h1>
          <p className="mt-4 text-gray-600">
            Colly is sold locally by trained agents. The academy is free:{" "}
            {ACADEMY_COURSES.length} courses and {ACADEMY_LESSON_COUNT} lessons
            cover how the assistant works, how to set a business up, how to train
            its owner, and how to find and keep customers of your own.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/signup?role=agent"
              className="rounded-lg bg-[#FF6600] px-6 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-[#E65C00]"
            >
              Apply as an agent
            </Link>
            <Link
              href="/agents/login"
              className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-center text-sm font-semibold text-gray-900 transition-colors hover:border-gray-400"
            >
              Agent sign in
            </Link>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-5xl px-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: BookOpen, label: `${ACADEMY_LESSON_COUNT} lessons`, hint: "Across four courses" },
              { icon: BadgeCheck, label: `${ACADEMY_COURSES.length} badges`, hint: `Pass each quiz at ${QUIZ_PASS_MARK}%` },
              { icon: GraduationCap, label: `${FINAL_EXAM_QUESTION_COUNT} exam questions`, hint: "Unlocks after all four badges" },
              { icon: Wallet, label: `${AGENT_COMMISSION_PERCENT}% commission`, hint: `For ${AGENT_COMMISSION_MONTHS} months per referral` },
            ].map(({ icon: Icon, label, hint }) => (
              <div
                key={label}
                className="rounded-xl border border-white/50 bg-white/60 p-5 shadow-lg backdrop-blur-md"
              >
                <Icon className="h-5 w-5 text-[#FF6600]" aria-hidden />
                <p className="mt-3 font-semibold text-gray-900">{label}</p>
                <p className="mt-1 text-sm text-gray-500">{hint}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white/60 py-16 sm:py-20">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="font-display text-2xl font-bold text-gray-900 sm:text-3xl">
            The four courses
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-gray-600">
            Work through them in order. Every lesson saves your progress, so you
            can stop and come back on any device.
          </p>
          <ol className="mt-8 grid gap-4 md:grid-cols-2">
            {ACADEMY_COURSES.map((course, index) => (
              <li
                key={course.slug}
                className="rounded-xl border border-gray-200 bg-white p-6"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Course {index + 1}
                </p>
                <h3 className="mt-2 font-display text-lg font-bold text-gray-900">
                  {course.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  {course.summary}
                </p>
                <p className="mt-4 text-xs font-medium text-gray-500">
                  {course.lessonCount} lessons · badge on a {QUIZ_PASS_MARK}% quiz
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="font-display text-2xl font-bold text-gray-900 sm:text-3xl">
            How certification works
          </h2>
          <ol className="mt-6 space-y-4">
            {[
              "Finish every lesson in a course. Your progress is saved per lesson, so you can pick up where you stopped.",
              `Pass that course's quiz at ${QUIZ_PASS_MARK}% or better to earn its badge. A wrong answer shows the explanation, so a retake actually teaches you something.`,
              `Collect all ${ACADEMY_COURSES.length} badges and the ${FINAL_EXAM_QUESTION_COUNT}-question final exam unlocks.`,
              "Pass the final exam and Colly issues your certificate: a PDF you can send to prospects, plus a public verification page for anyone who wants to check it.",
            ].map((step, index) => (
              <li key={step} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FF6600]/10 text-sm font-semibold text-[#FF6600]">
                  {index + 1}
                </span>
                <p className="pt-1 text-sm leading-relaxed text-gray-600">
                  {step}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-white/60 py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4">
          <h2 className="font-display text-2xl font-bold text-gray-900 sm:text-3xl">
            How agents get paid
          </h2>
          <div className="mt-6 space-y-4 text-sm leading-relaxed text-gray-600">
            <p>
              <strong className="font-semibold text-gray-900">
                Your setup fee is yours.
              </strong>{" "}
              You charge the business whatever your onboarding work is worth —
              Colly takes no cut of it.
            </p>
            <p>
              <strong className="font-semibold text-gray-900">
                {AGENT_COMMISSION_PERCENT}% of every subscription payment.
              </strong>{" "}
              Each business you refer is linked to your agent number for{" "}
              {AGENT_COMMISSION_MONTHS} months, and you earn{" "}
              {AGENT_COMMISSION_PERCENT}% of every plan payment it makes in that
              window. The commission lands in your agent wallet.
            </p>
            <p>
              <strong className="font-semibold text-gray-900">
                Payouts through Paystack.
              </strong>{" "}
              Request a payout once your wallet balance reaches {PAYOUT_MINIMUM};
              it is paid into the Nigerian bank account you add in your
              dashboard.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="font-display text-2xl font-bold text-gray-900 sm:text-3xl">
            Ready to start?
          </h2>
          <p className="mt-3 text-gray-600">
            Create your agent account and the first course is waiting. You can
            also see exactly what you will be selling before you commit.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/signup?role=agent"
              className="rounded-lg bg-[#FF6600] px-6 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-[#E65C00]"
            >
              Apply as an agent
            </Link>
            <Link
              href="/pricing"
              className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-center text-sm font-semibold text-gray-900 transition-colors hover:border-gray-400"
            >
              See what businesses pay
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
