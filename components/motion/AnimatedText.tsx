"use client";

import { useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
  MotionValue,
} from "framer-motion";

interface AnimatedTextProps {
  text: string;
  className?: string;
}

/**
 * Character-by-character scroll reveal: each character brightens from
 * 20% to full opacity as the paragraph moves through the viewport.
 */
export default function AnimatedText({ text, className }: AnimatedTextProps) {
  const ref = useRef<HTMLParagraphElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.8", "end 0.2"],
  });

  const chars = text.split("");

  if (reduceMotion) {
    return <p className={className}>{text}</p>;
  }

  return (
    <p ref={ref} className={className} aria-label={text}>
      {chars.map((char, i) => (
        <Char
          key={i}
          char={char}
          progress={scrollYProgress}
          range={[i / chars.length, Math.min(1, (i + 4) / chars.length)]}
        />
      ))}
    </p>
  );
}

function Char({
  char,
  progress,
  range,
}: {
  char: string;
  progress: MotionValue<number>;
  range: [number, number];
}) {
  const opacity = useTransform(progress, range, [0.2, 1]);
  return (
    <motion.span aria-hidden="true" style={{ opacity }}>
      {char}
    </motion.span>
  );
}
