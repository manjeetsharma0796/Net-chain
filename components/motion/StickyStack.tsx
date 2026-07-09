"use client";

import { ReactNode } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
} from "framer-motion";

interface StickyStackCardProps {
  children: ReactNode;
  /** Index of this card in the stack (0-based). */
  index: number;
  /** Total number of cards in the stack. */
  total: number;
  /** Ref of the shared scroll container (the section wrapping all cards). */
  containerRef: React.RefObject<HTMLElement>;
  className?: string;
}

/**
 * One card in a sticky-stacking sequence. Each card pins below the last
 * (offset by 28px per index) and scales down slightly as later cards
 * scroll over it.
 */
export function StickyStackCard({
  children,
  index,
  total,
  containerRef,
  className = "",
}: StickyStackCardProps) {
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const targetScale = 1 - (total - 1 - index) * 0.03;
  const scale = useTransform(
    scrollYProgress,
    [index / total, 1],
    [1, targetScale],
  );

  return (
    <div
      className="sticky"
      style={{ top: `calc(6rem + ${index * 28}px)` }}
    >
      <motion.div
        style={reduceMotion ? undefined : { scale }}
        className={`origin-top rounded-[40px] border-2 border-frost bg-ink ${className}`}
      >
        {children}
      </motion.div>
    </div>
  );
}
