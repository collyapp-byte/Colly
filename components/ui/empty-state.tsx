"use client";

import { Player } from "@lottiefiles/react-lottie-player";
import { ReactNode } from "react";

interface EmptyStateProps {
  src: string; // Changed to accept a URL string
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  children?: ReactNode;
}

export function EmptyState({
  src,
  title,
  description,
  actionLabel,
  onAction,
  children,
}: EmptyStateProps) {
  return (
    <div className="surface-card flex flex-col items-center justify-center px-4 py-14 text-center">
      <div className="mb-4 h-40 w-40">
        <Player
          autoplay
          loop
          src={src}
          style={{ height: '100%', width: '100%' }}
        />
      </div>
      <h3 className="mb-2 text-xl font-semibold text-main">{title}</h3>
      <p className="mb-6 max-w-sm text-muted">{description}</p>

      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-[#FF6600] px-6 text-sm font-semibold text-white shadow-brand transition-all duration-250 hover:-translate-y-0.5 hover:bg-[#E65C00] hover:shadow-brand-hover active:translate-y-0 active:scale-[0.98]"
        >
          {actionLabel}
        </button>
      )}
      {children}
    </div>
  );
}