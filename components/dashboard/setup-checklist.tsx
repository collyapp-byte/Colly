"use client";

import Link from "next/link";
import { ArrowRight, Package, HelpCircle, Sparkles } from "lucide-react";
import { Lottie } from "@/components/ui/lottie";

interface SetupChecklistProps {
  hasProducts: boolean;
  hasFaqs: boolean;
  hasAiReply: boolean;
}

export function SetupChecklist({ hasProducts, hasFaqs, hasAiReply }: SetupChecklistProps) {
  if (hasProducts && hasFaqs && hasAiReply) return null;

  const steps = [
    {
      title: "Add your first product",
      description: "You need products to create a catalogue. The AI uses this to answer questions and negotiate prices.",
      href: "/products",
      completed: hasProducts,
      icon: Package,
      actionText: "Add product",
    },
    {
      title: "Add your first FAQ",
      description: "Teach your AI to answer common questions like delivery times and payment methods.",
      href: "/faqs",
      completed: hasFaqs,
      icon: HelpCircle,
      actionText: "Add FAQs",
    },
    {
      title: "Test your shop bot",
      description: "Send a test message to see how the AI replies to customers using your new catalogue.",
      href: "/ai",
      completed: hasAiReply,
      icon: Sparkles,
      actionText: "Test AI",
    }
  ];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-colly/20 bg-colly-tint/40 p-5 shadow-card sm:p-6">
      <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-semibold text-main">Get started with Colly</h2>
          <p className="mt-1 text-sm text-muted">Complete these steps to get the most out of your AI.</p>
        </div>
        <div className="hidden h-40 w-40 shrink-0 sm:block -my-8 -mr-4">
          <Lottie src="/dashboard-rocket.json" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
        {steps.map((step, index) => {
          if (step.completed) return null;
          const Icon = step.icon;

          // The whole card is the target: a single anchor keeps the markup
          // valid and gives the card one large, forgiving tap area on mobile.
          return (
            <Link
              key={index}
              href={step.href}
              className="surface-card surface-card-interactive group flex flex-col gap-3 p-4.5 sm:p-5"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-colly-tint text-colly ring-1 ring-colly/15 transition-transform duration-250 group-hover:scale-105">
                  <Icon className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-semibold text-main">
                  {step.title}
                </h3>
              </div>
              <p className="flex-1 text-xs leading-relaxed text-muted">
                {step.description}
              </p>
              <span className="mt-1 inline-flex items-center text-xs font-bold text-colly">
                {step.actionText}
                <ArrowRight className="ml-1 h-3 w-3 transition-transform duration-250 group-hover:translate-x-1" />
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}