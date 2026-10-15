"use client";

import { LoadingLogo } from "@/components/ui/loading-logo";

export default function ContentLoading() {
  return (
    <div className="flex min-h-[calc(100vh-56px)] items-center justify-center bg-[#F9FAFB]">
      <LoadingLogo size="md" label="Loading…" />
    </div>
  );
}
