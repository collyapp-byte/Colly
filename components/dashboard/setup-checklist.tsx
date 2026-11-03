"use client";

import Link from "next/link";
import { CheckCircle2, ArrowRight } from "lucide-react";

interface SetupChecklistProps {
  hasProducts: boolean;
  hasAiReply: boolean;
}

export function SetupChecklist({ hasProducts, hasAiReply }: SetupChecklistProps) {
  // If everything is done, hide the checklist
  if (hasProducts && hasAiReply) return null;

  const steps = [
    {
      num: "1",
      title: "Add your first product",
      description: "You need products to create a catalogue. The AI uses this to answer questions and negotiate prices.",
      href: "/products",
      completed: hasProducts,
      actionText: "Add product",
    },
    {
      num: "2",
      title: "Test your shop bot",
      description: "Send a test message to see how the AI replies to customers using your new catalogue.",
      href: "/ai",
      completed: hasAiReply,
      actionText: "Test AI",
    }
  ];

  return (
    <div className="rounded-2xl bg-[#FFF4EC]/40 border border-[#FF6600]/20 p-6 sm:p-8 mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Get started with Colly</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {steps.map((step, index) => {
          const isCompleted = step.completed;
          
          return (
            <div 
              key={index} 
              className={`relative flex gap-4 rounded-xl border p-5 transition-all ${
                isCompleted ? "border-green-200 bg-green-50/30" : "border-gray-200 bg-white shadow-sm hover:border-[#FF6600]/50"
              }`}
            >
              {/* Step Number / Checkmark */}
              <div className="shrink-0">
                {isCompleted ? (
                  <CheckCircle2 className="h-10 w-10 text-green-500" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FFF4EC] text-xl font-bold text-[#FF6600]">
                    {step.num}
                  </div>
                )}
              </div>
              
              {/* Content */}
              <div className="flex-1">
                <h3 className={`font-semibold ${isCompleted ? "text-green-800" : "text-gray-900"}`}>
                  {step.title}
                </h3>
                <p className={`mt-1 text-sm leading-relaxed ${isCompleted ? "text-green-700/80" : "text-gray-500"}`}>
                  {step.description}
                </p>
                
                {!isCompleted && (
                  <Link 
                    href={step.href}
                    className="mt-4 inline-flex items-center text-sm font-semibold text-[#FF6600] hover:text-[#E65C00]"
                  >
                    {step.actionText} <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}