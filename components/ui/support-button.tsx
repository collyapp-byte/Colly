import { LifeBuoy } from "lucide-react";

export function SupportButton() {
  return (
    <a
      href="mailto:support@colly.app"
      className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-[#2563EB] px-4 py-3 text-sm font-medium text-white shadow-lg transition-colors hover:bg-[#1D4ED8]"
    >
      <LifeBuoy className="h-5 w-5" aria-hidden />
      Support
    </a>
  );
}
