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
      className={`surface-card group relative flex min-h-[104px] flex-col justify-between gap-3 p-3.5 md:min-h-0 md:p-5 ${
        isClickable ? "surface-card-interactive" : ""
      }`}
      {...(href ? { href } : {})}
      {...(onClick ? { onClick } : {})}
      {...(isClickable && !href ? { type: "button" as const } : {})}
      title={title}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-[11px] font-medium tracking-wide text-muted uppercase md:text-[12px]">
          {label}
        </p>
        {icon && (
          <span
            className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-colly-tint text-colly ring-1 ring-colly/15 transition-transform duration-250 group-hover:scale-105"
            aria-hidden
          >
            {icon}
          </span>
        )}
      </div>
      <div className="flex items-end justify-between gap-2">
        <p className="font-display text-2xl font-bold tracking-tight text-main md:text-3xl">
          {value}
        </p>
        {isClickable && (
          <ChevronRight
            className="mb-1 hidden h-4 w-4 shrink-0 text-muted transition-all duration-250 group-hover:translate-x-0.5 group-hover:text-colly md:block"
            aria-hidden
          />
        )}
      </div>
    </Tag>
  );
}
