"use client";

import { Player } from "@lottiefiles/react-lottie-player";
import { ReactNode } from "react";

interface EmptyStateProps {
  animationData: any;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  children?: ReactNode;
}

export function EmptyState({
  animationData,
  title,
  description,
  actionLabel,
  onAction,
  children,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white py-16 px-4 text-center">
      <div className="mb-6 h-48 w-48">
        <Player
          autoplay
          loop
          src={animationData}
          style={{ height: '100%', width: '100%' }}
        />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 mb-6 max-w-sm">{description}</p>
      
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-[#FF6600] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#E65C00]"
        >
          {actionLabel}
        </button>
      )}
      {children}
    </div>
  );
}