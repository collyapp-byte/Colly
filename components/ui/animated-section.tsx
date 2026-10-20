"use client";

import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

/**
 * Scroll-reveal container. Fades and slides its children in once when the
 * section enters the viewport, staggering each `AnimatedItem` by 0.1s so a
 * block of text/elements arrives one after another (Linear/Stripe style).
 */
const containerVariants: Variants = {
  hidden: { opacity: 0, y: 50 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, staggerChildren: 0.1 },
  },
};

/** Child variant inherited by every `AnimatedItem` inside the container. */
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 50 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
};

export function AnimatedSection({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-100px" }}
    >
      {children}
    </motion.div>
  );
}

/**
 * A single staggered child of an `AnimatedSection`. Renders a plain `div` by
 * default so it can sit anywhere in the layout without breaking HTML
 * semantics (e.g. inside an `<ol>` of steps).
 */
export function AnimatedItem({
  children,
  className,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "span" | "li" | "p" | "h1" | "h2" | "h3";
}) {
  const Tag = motion[as];
  return (
    <Tag className={className} variants={itemVariants}>
      {children}
    </Tag>
  );
}
