"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { motion, useScroll, useSpring } from "framer-motion";

export interface Slide {
  id: string;
  label: string;
  node: ReactNode;
}

/**
 * The landing scroll system (ported from the inspo deck):
 * a full-viewport snap container — every slide is exactly one screen
 * and scrolling snaps between them — plus a right-side dot nav and a
 * spring-smoothed progress bar across the top.
 */
export default function LandingShell({
  slides,
  nav,
}: {
  slides: Slide[];
  /** Render prop so the fixed nav can react to the active slide. */
  nav?: (activeSection: number) => ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState(0);

  const { scrollYProgress } = useScroll({ container: containerRef });
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handleScroll = () => {
      setActiveSection(
        Math.round(container.scrollTop / container.clientHeight),
      );
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  const handleNavClick = (index: number) => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollTo({
      top: index * container.clientHeight,
      behavior: "smooth",
    });
  };

  return (
    <>
      {nav?.(activeSection)}

      {/* spring progress bar */}
      <motion.div
        className="fixed inset-x-0 top-0 z-[60] h-0.5 origin-left bg-accent"
        style={{ scaleX }}
        aria-hidden="true"
      />

      {/* dot nav */}
      <nav
        aria-label="Sections"
        className="fixed right-0 top-0 z-40 flex h-dvh flex-col justify-center p-4"
      >
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            onClick={() => handleNavClick(index)}
            aria-label={`Go to ${slide.label}`}
            aria-current={index === activeSection ? "true" : undefined}
            className={`my-2 h-2.5 w-2.5 cursor-pointer rounded-full transition-all duration-300 ${
              index === activeSection
                ? "scale-150 bg-frost"
                : "bg-frost/25 hover:bg-frost/50"
            }`}
          />
        ))}
      </nav>

      {/* the snap deck */}
      <div
        ref={containerRef}
        data-scroll-container
        className="h-dvh snap-y snap-mandatory overflow-y-auto scroll-smooth"
      >
        {slides.map((slide) => (
          <section
            key={slide.id}
            aria-label={slide.label}
            className="h-dvh snap-start overflow-hidden"
          >
            {slide.node}
          </section>
        ))}
      </div>
    </>
  );
}
