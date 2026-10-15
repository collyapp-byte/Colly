import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  href?: string;
  onClick?: () => void;
}

export function StatCard({
  label,
  value,
  icon,
  href,
  onClick,
}: StatCardProps) {
  const isClickable = href || onClick;
  const Tag = isClickable ? (href ? "a" : "button") : "div";

  return (
    <Tag
      className={`relative p-3 md:p-5 ${
        isClickable
          ? "cursor-pointer border border-transparent transition-colors md:hover:border-[#FF6600]/30"
          : ""
      }`}
      {...(href ? { href } : {})}
      {...(onClick ? { onClick } : {})}
    >
      {icon && (
        <div
          className="absolute top-3 right-3 text-gray-400 md:top-4 md:right-4"
          aria-hidden
        >
          {icon}
        </div>
      )}
      <p className="mb-1 pr-8 text-[11px] font-medium text-gray-500 md:mb-2 md:pr-0 md:text-[13px]">
        {label}
      </p>
      <div className="flex items-end justify-between">
        <p className="font-display text-xl font-bold text-gray-900 md:text-2xl">
          {value}
        </p>
        {isClickable && (
          <ChevronRight
            className="hidden h-3.5 w-3.5 text-gray-300 md:block"
            aria-hidden
          />
        )}
      </div>
    </Tag>
  );
}
