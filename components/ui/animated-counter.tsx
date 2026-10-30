"use client";

import { useEffect, useRef, useState } from "react";

/** Count-up duration, same 1.5 s the framer-motion `animate()` call used. */
const COUNT_UP_MS = 1500;

/** The `easeOut` curve the old version used: quick start, soft landing. */
function easeOut(progress: number) {
  return 1 - Math.pow(1 - progress, 3);
}

/**
 * Counts a stat from 0 up to its value once, on mount.
 *
 * This used to call `animate()` from framer-motion, which pulled the whole
 * library (~78KB minified, ~27KB gzipped) into the dashboard bundle for a single
 * tween. A requestAnimationFrame loop does the same job in a few lines and is
 * self-limiting: it stops at the final value and the frame is cancelled on
 * unmount, so nothing keeps ticking on the main thread while the owner clicks
 * around (INP).
 *
 * Hydration-safe by construction: the server renders `0` and the client starts
 * from `0`, and the number only changes inside a frame callback — never during
 * the effect body, which would cascade a render of the whole stat grid.
 * `prefers-reduced-motion` jumps straight to the value on the first frame.
 */
export function AnimatedCounter({
  value,
  prefix = "",
  suffix = "",
}: {
  value: number;
  prefix?: string;
  suffix?: string;
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const frameRef = useRef(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();

    const step = (now: number) => {
      const progress = reduced ? 1 : Math.min((now - start) / COUNT_UP_MS, 1);
      setDisplayValue(Math.round(easeOut(progress) * value));

      if (progress < 1) frameRef.current = requestAnimationFrame(step);
    };

    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [value]);

  return (
    <span>
      {prefix}
      {displayValue.toLocaleString()}
      {suffix}
    </span>
  );
}

