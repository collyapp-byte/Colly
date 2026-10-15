import Image from "next/image";
import type { ReactNode } from "react";

interface EmptyStateProps {
  illustration?: string;
  title: string;
  description: string;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
}

export function EmptyState({
  illustration = "/empty-state.svg",
  title,
  description,
  primaryAction,
  secondaryAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Image
        src={illustration}
        alt=""
        width={200}
        height={200}
        aria-hidden
        priority={false}
      />
      <h3 className="mt-6 text-lg font-semibold text-gray-900">{title}</h3>
      <p className="mt-2 max-w-md text-center text-sm text-gray-500">
        {description}
      </p>
      {(primaryAction || secondaryAction) && (
        <div className="mt-6 flex gap-3">
          {secondaryAction}
          {primaryAction}
        </div>
      )}
    </div>
  );
}
