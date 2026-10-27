"use client";
import { motion } from "framer-motion";
import { ReactNode } from "react";

/**
 * Reveal states. `HIDDEN` is serialised into the server HTML as
 * `style="opacity:0..."`, which is fine for content that is scrolled to later
 * but fatal for anything above the fold: the element is the LCP candidate and
 * cannot paint until the client bundle hydrates and the 0.7 s animation ends.
 */
const HIDDEN = { opacity: 0, y: 50, filter: "blur(8px)" };
const VISIBLE = { opacity: 1, y: 0, filter: "blur(0px)" };

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
   * visible state, so the server HTML paints it on first paint and LCP never
   * waits for hydration. Leave it off for below-the-fold sections, which should
   * still animate in on scroll.
   */
  immediate?: boolean;
}) {
  return (
    <motion.div
      initial={immediate ? VISIBLE : HIDDEN}
      whileInView={VISIBLE}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.7, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
