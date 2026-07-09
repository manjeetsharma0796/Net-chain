"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ReactNode } from "react";

interface FadeInProps {
  children: ReactNode;
  /** Seconds to wait before animating in. */
  delay?: number;
  duration?: number;
  /** Initial offset — element slides from (x, y) to rest. */
  x?: number;
  y?: number;
  className?: string;
}

/**
 * Scroll-triggered fade + slide. Fires once when the element enters the
 * viewport, matching the landing-page choreography.
 */
export default function FadeIn({
  children,
  delay = 0,
  duration = 0.7,
  x = 0,
  y = 30,
  className,
}: FadeInProps) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, x, y }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: "50px", amount: 0 }}
      transition={{ delay, duration, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {children}
    </motion.div>
  );
}
