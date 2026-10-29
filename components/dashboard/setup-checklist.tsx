"use client";

import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

/**
 * Activation checklist for a business that has not finished setting up.
 *
 * The three flags are computed on the server (`app/(dashboard)/dashboard/page.tsx`
 * reads `Business.telegramBotToken` plus the product and customer-message
 * counts), so this component never queries: it only decides what to show. Once
 * all three are true it renders nothing, so the card leaves the overview for
 * good instead of nagging an activated owner.
 */
type SetupChecklistProps = {
  /** A Telegram bot token is stored on the business. */
  hasTelegram: boolean;
  /** The catalogue has at least one product. */
  hasProducts: boolean;
  /** At least one message arrived from a customer, i.e. the bot was reached. */
  hasMessages: boolean;
};

type SetupStep = {
  title: string;
  description: string;
  /** Where the owner completes the step; the last step is instructions only. */
  href?: string;
  /** Label of the link that completes the step. */
  action?: string;
  done: boolean;
};

export function SetupChecklist({
  hasTelegram,
  hasProducts,
  hasMessages,
}: SetupChecklistProps) {
  const steps: SetupStep[] = [
    {
      title: "Connect your Telegram Bot",
      description:
        "Paste your BotFather token so Colly can answer your customers on Telegram.",
      href: "/settings/ai-line",
      action: "Connect bot",
      done: hasTelegram,
    },
    {
      title: "Add your first Product",
      description:
        "Your AI only sells what is in your catalogue, so add a product with its price and stock.",
      href: "/products",
      action: "Add product",
      done: hasProducts,
    },
    {
      title: "Send a test message to your bot",
      description:
        'Open Telegram and message your bot anything, for example "How much is this?". The first customer message you receive ticks this step.',
      done: hasMessages,
    },
  ];

  // Fully activated: the checklist has done its job and disappears.
  if (hasTelegram && hasProducts && hasMessages) {
    return null;
  }

  const completed = steps.filter((step) => step.done).length;
  const remaining = steps.length - completed;
  const percent = Math.round((completed / steps.length) * 100);

  return (
    <section
      aria-labelledby="setup-checklist-heading"
      className="mb-6 rounded-xl border border-[#FF6600]/30 bg-[#FFF4EC] p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2
            id="setup-checklist-heading"
            className="text-sm font-semibold text-gray-900"
          >
            Finish setting up
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {remaining} step{remaining === 1 ? "" : "s"} left before your AI can
            sell on its own.
          </p>
        </div>
        <span className="shrink-0 text-sm font-semibold text-[#FF6600]">
          {completed}/{steps.length}
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={completed}
        aria-label="Setup progress"
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#FF6600]/15"
      >
        <div
          className="h-full rounded-full bg-[#FF6600] transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>

      <ol className="mt-4 space-y-2">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4"
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                step.done
                  ? "bg-green-100 text-green-600"
                  : "bg-[#FF6600] text-white"
              }`}
            >
              {step.done ? (
                <Check className="h-4 w-4 stroke-[3]" aria-hidden />
              ) : (
                index + 1
              )}
            </span>

            <div className="min-w-0 flex-1">
              <p
                className={`text-sm font-medium ${
                  step.done ? "text-gray-500" : "text-gray-900"
                }`}
              >
                {step.title}
                {step.done && (
                  <span className="ml-2 text-xs font-semibold text-green-600">
                    Done
                  </span>
                )}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                {step.description}
              </p>
              {/* Pending steps that live elsewhere get a link; the last step is
                  done inside Telegram, so it stays instructions only. */}
              {step.href && !step.done && (
                <Link
                  href={step.href}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#FF6600] transition-colors hover:text-[#E65C00]"
                >
                  {step.action}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
