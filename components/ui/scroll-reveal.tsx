"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Where a section starts revealing, as an inset from the viewport edges. Same
 * 100px inset the framer-motion `viewport.margin` used: the element has to be
 * properly inside the viewport, not just touching the edge.
 */
const REVEAL_MARGIN = "-100px";

/**
 * Fade + rise on scroll — CSS only.
 *
 * This used to be a framer-motion `motion.div` that animated `opacity`, `y` and
 * a `blur(8px)` filter. Two costs came with that: framer-motion (~78KB minified,
 * ~27KB gzipped — it was the single largest chunk on the marketing route) shipped
 * to every marketing visitor, and the blur filter re-rasterised the whole
 * section on every frame. A plain IntersectionObserver that flips one class
 * gives the same effect from the compositor, keeps the main thread free for
 * clicks (INP) and drops the library from the bundle.
 *
 * The hidden state is still serialised into the server HTML, so nothing above
 * the fold should ever mount without `immediate` — the element would be the LCP
 * candidate and could not paint until hydration.
 */
export function ScrollReveal({
  children,
  delay = 0,
  className = "",
  immediate = false,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  /**
   * Use for above-the-fold content (the hero). The element then starts in the
   * visible state, paints with the server HTML and LCP never waits for
   * hydration. Leave it off for below-the-fold sections, which should still
   * animate in on scroll.
   */
  immediate?: boolean;
}) {
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const [revealed, setRevealed] = useState(immediate);

  useEffect(() => {
    if (immediate || revealed) return;

    const node = nodeRef.current;
    if (!node) return;

    // No `IntersectionObserver === undefined` branch: the App Router bundle
    // targets browsers where it is baseline (Next 16 targets Chrome 111+ /
    // Safari 16.4+), and a state write here would be a cascading render — the
    // exact pattern this rewrite exists to avoid.
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setRevealed(true);
        observer.disconnect(); // reveal once, never on scroll back up
      },
      { rootMargin: REVEAL_MARGIN },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [immediate, revealed]);

  return (
    <div
      ref={nodeRef}
      className={`reveal ${
        revealed ? "reveal-visible" : "reveal-hidden"
      } ${className}`.trim()}
      /* The stagger lives in the inline transition-delay, exactly as the old
         `transition={{ delay }}` did. */
      style={delay ? { transitionDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}

