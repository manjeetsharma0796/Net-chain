"use client";

/**
 * Odometer-style rolling counter — adapted from 21st.dev
 * (YadHakim/number-ticker) and restyled to the NetChain system:
 * mono `figures` face, reduced-motion fallback, frost palette.
 * Each digit rolls independently on a spring; higher-order digits
 * start first so the number resolves in a cascade.
 */

import {
  motion,
  useInView,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import { useEffect, useMemo, useRef } from "react";

interface NumberTickerProps {
  value: number;
  className?: string;
  delay?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  /** Seconds over which the digit cascade staggers. */
  duration?: number;
}

function Digit({ digit, delay }: { digit: number; delay: number }) {
  const spring = useSpring(10, { stiffness: 60, damping: 20, mass: 0.8 });
  const y = useTransform(spring, (v) => {
    const current = ((v % 10) + 10) % 10;
    return `${-current * 10}%`;
  });

  useEffect(() => {
    const timer = setTimeout(() => spring.set(digit), delay * 1000);
    return () => clearTimeout(timer);
  }, [digit, delay, spring]);

  return (
    <span
      className="relative inline-block overflow-hidden"
      style={{ height: "1em", width: "0.62em" }}
    >
      <motion.span
        className="absolute inset-x-0 flex flex-col items-center"
        style={{ y }}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <span
            key={n}
            className="flex items-center justify-center"
            style={{ height: "1em" }}
          >
            {n}
          </span>
        ))}
      </motion.span>
    </span>
  );
}

export default function NumberTicker({
  value,
  className = "",
  delay = 0,
  prefix,
  suffix,
  decimals = 0,
  duration = 1.2,
}: NumberTickerProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const reduceMotion = useReducedMotion();

  const formatted = useMemo(() => {
    const [whole, dec] = value.toFixed(decimals).split(".");
    const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return dec ? `${withCommas}.${dec}` : withCommas;
  }, [value, decimals]);

  const chars = formatted.split("");
  const digitCount = chars.filter((c) => /\d/.test(c)).length;
  let digitIndex = 0;

  if (reduceMotion) {
    return (
      <span className={`figures ${className}`}>
        {prefix}
        {formatted}
        {suffix}
      </span>
    );
  }

  return (
    <span
      ref={ref}
      aria-label={`${prefix ?? ""}${formatted}${suffix ?? ""}`}
      className={`figures inline-flex items-baseline leading-none ${className}`}
    >
      {prefix && <span aria-hidden="true">{prefix}</span>}
      {chars.map((char, i) => {
        if (/\d/.test(char)) {
          const stagger = delay + (digitIndex / digitCount) * duration * 0.6;
          digitIndex++;
          return isInView ? (
            <Digit key={i} digit={parseInt(char, 10)} delay={stagger} />
          ) : (
            <span
              key={i}
              aria-hidden="true"
              className="inline-block"
              style={{ width: "0.62em" }}
            >
              0
            </span>
          );
        }
        return (
          <span key={i} aria-hidden="true">
            {char}
          </span>
        );
      })}
      {suffix && <span aria-hidden="true">{suffix}</span>}
    </span>
  );
}
