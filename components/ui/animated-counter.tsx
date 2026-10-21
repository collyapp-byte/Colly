"use client";
import { useEffect, useState } from "react";
import { animate } from "framer-motion";

export function AnimatedCounter({ value, prefix = "", suffix = "" }: { value: number, prefix?: string, suffix?: string }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const controls = animate(0, value, {
      duration: 1.5,
      ease: "easeOut",
      onUpdate: (latest) => setDisplayValue(Math.floor(latest)),
    });
    return () => controls.stop();
  }, [value]);

  return <span>{prefix}{displayValue.toLocaleString()}{suffix}</span>;
}
