"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

type BackButtonProps = {
  className?: string;
};

/** Small "Back" control for sub-page headers. Uses browser history. */
export function BackButton({ className = "" }: BackButtonProps) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className={`mb-2 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-gray-500 transition-all hover:text-gray-900 active:scale-95 active:opacity-70 ${className}`}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Back
    </button>
  );
}
