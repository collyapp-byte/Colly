"use client";

import Image from "next/image";

type LoadingLogoSize = "sm" | "md" | "lg";

const SIZE_PX: Record<LoadingLogoSize, number> = {
  sm: 40,
  md: 72,
  lg: 112,
};

type LoadingLogoProps = {
  size?: LoadingLogoSize;
  label?: string;
};

export function LoadingLogo({ size = "md", label }: LoadingLogoProps) {
  const px = SIZE_PX[size];

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative" style={{ width: px, height: px }}>
        <div
          className="animate-colly-glow absolute inset-0 rounded-full bg-[#FF6600]/30 blur-2xl"
          aria-hidden
        />
        <div
          className="absolute -inset-2 animate-spin rounded-full border border-gray-200 border-t-[#FF6600]"
          aria-hidden
        />
        <div className="animate-colly-breathe relative">
          <Image src="/logo.svg" alt="Colly" width={px} height={px} priority />
        </div>
      </div>
      {label && (
        <p
          className="animate-in mt-3 text-[13px] text-gray-500"
          style={{ animationDelay: "300ms" }}
        >
          {label}
        </p>
      )}
    </div>
  );
}
