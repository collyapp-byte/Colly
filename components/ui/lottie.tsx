"use client";

import dynamic from "next/dynamic";

const Player = dynamic(
  () => import("@lottiefiles/react-lottie-player").then((mod) => mod.Player),
  { ssr: false }
);

export function Lottie({ src, className }: { src: string; className?: string }) {
  return (
    <Player
      autoplay
      loop
      src={src}
      style={{ width: "100%", height: "100%" }}
      className={className}
    />
  );
}