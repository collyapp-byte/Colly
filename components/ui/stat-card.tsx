import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number | ReactNode;
  icon?: ReactNode;
  href?: string;
  onClick?: () => void;
  title?: string;
}

export function StatCard({
  label,
  value,
  icon,
  href,
  onClick,
  title,
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
      title={title}
    >
      <div className="mb-1 flex items-center justify-between gap-2 md:mb-2">
        <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-gray-500 md:text-[13px]">
          {label}
        </p>
        {icon && (
          <span
            className="ml-auto shrink-0 text-gray-400"
            aria-hidden
          >
            {icon}
          </span>
        )}
      </div>
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
