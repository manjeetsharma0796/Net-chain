"use client";

import {
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useReducedMotion } from "framer-motion";

interface MagnetProps {
  children: ReactNode;
  /** Distance (px) beyond the element bounds where the magnet activates. */
  padding?: number;
  /** Higher divisor = weaker pull. */
  strength?: number;
  className?: string;
}

/**
 * Mouse-following magnetic hover. The wrapped element is gently pulled
 * toward the cursor while it is within `padding` px of the element,
 * then eases back to rest. Applied to abstract visuals and key CTAs.
 */
export default function Magnet({
  children,
  padding = 100,
  strength = 8,
  className,
}: MagnetProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);
  const reduceMotion = useReducedMotion();

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const within =
        e.clientX > rect.left - padding &&
        e.clientX < rect.right + padding &&
        e.clientY > rect.top - padding &&
        e.clientY < rect.bottom + padding;

      if (within) {
        setActive(true);
        setOffset({
          x: (e.clientX - cx) / strength,
          y: (e.clientY - cy) / strength,
        });
      } else {
        setActive(false);
        setOffset({ x: 0, y: 0 });
      }
    },
    [padding, strength],
  );

  useEffect(() => {
    if (reduceMotion) return;
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, [onMouseMove, reduceMotion]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
        transition: active
          ? "transform 0.3s ease-out"
          : "transform 0.6s ease-in-out",
        willChange: "transform",
      }}
    >
      {children}
    </div>
  );
}
