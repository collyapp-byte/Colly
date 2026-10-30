"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type PointerEvent,
  type ReactNode,
} from "react";

/** Rotation at the card's edge, in degrees. */
const MAX_TILT_DEG = 10;

/**
 * Pointer-tracking 3D tilt for the pricing cards — CSS only.
 *
 * framer-motion used to interpolate two motion values on every `mousemove`,
 * which meant a React-level animation frame per pointer event on the most
 * interactive part of the marketing page (the pricing CTAs sit inside it: that
 * is INP). Here the pointer handler writes two CSS variables into a
 * requestAnimationFrame callback at most once per frame, and the transform
 * itself is declarative CSS, so the browser composites it.
 *
 * Touch and pen are ignored: the tilt is a hover affordance, and a style write
 * per finger move would only cost main-thread time during a scroll.
 */
export function TiltCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef(0);

  // A queued frame must not outlive the card (the pricing section can unmount).
  useEffect(
    () => () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  const reset = useCallback(() => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    }

    const node = cardRef.current;
    if (!node) return;

    delete node.dataset.tilting;
    node.style.setProperty("--tilt-x", "0deg");
    node.style.setProperty("--tilt-y", "0deg");
  }, []);

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse") return;
    // One write per frame: a burst of pointer events collapses into a single
    // style update instead of one per event.
    if (frameRef.current) return;

    const { clientX, clientY } = event;

    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0;

      const node = cardRef.current;
      if (!node) return;

      const rect = node.getBoundingClientRect();
      // -1 at one edge, 0 in the middle, 1 at the other; a degenerate rect
      // (hidden card) would divide by zero, so bail out instead.
      if (!rect.width || !rect.height) return;

      const offsetX = (clientX - rect.left - rect.width / 2) / (rect.width / 2);
      const offsetY = (clientY - rect.top - rect.height / 2) / (rect.height / 2);

      // `data-tilting` drops the ease-out while the pointer is inside, so the
      // card tracks the cursor exactly and still glides back on leave.
      node.dataset.tilting = "true";
      node.style.setProperty(
        "--tilt-y",
        `${(offsetX * MAX_TILT_DEG).toFixed(2)}deg`,
      );
      node.style.setProperty(
        "--tilt-x",
        `${(-offsetY * MAX_TILT_DEG).toFixed(2)}deg`,
      );
    });
  }

  return (
    <div
      ref={cardRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={reset}
      className={`tilt-card relative rounded-2xl transition-shadow hover:shadow-xl ${className}`}
    >
      {/* Kept as its own element (and its own transform) to match the previous
          framer-motion markup, so the cards' internal layout is unchanged. */}
      <div className="tilt-card-inner">{children}</div>
    </div>
  );
}

