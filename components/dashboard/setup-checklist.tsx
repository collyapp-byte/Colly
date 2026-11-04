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
    <div className="rounded-2xl bg-[#FFF4EC]/40 border border-[#FF6600]/20 p-6 sm:p-8 mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Get started with Colly</h2>
          <p className="text-sm text-gray-500 mt-1">Complete these steps to get the most out of your AI.</p>
        </div>
        <div className="hidden sm:block h-24 w-24 shrink-0">
          <Lottie src="/dashboard-rocket.json" />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {steps.map((step, index) => {
          if (step.completed) return null;
          const Icon = step.icon;
          
          return (
            <div 
              key={index} 
              className="group flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:border-[#FF6600]/50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#FFF4EC] text-[#FF6600]">
                  <Icon className="h-4 w-4" />
                </div>
                <h3 className="font-semibold text-gray-900 text-sm">
                  {step.title}
                </h3>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed flex-1">
                {step.description}
              </p>
              <Link 
                href={step.href}
                className="mt-2 inline-flex items-center text-xs font-bold text-[#FF6600] hover:text-[#E65C00]"
              >
                {step.actionText} <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}