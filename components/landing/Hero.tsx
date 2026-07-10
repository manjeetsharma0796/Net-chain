"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import PrimaryCTAButton from "@/components/ui/PrimaryCTAButton";
import GhostButton from "@/components/ui/GhostButton";

/**
 * Full-screen hero, content bottom-left, staggered blur fade-ups.
 * The background is a fine ledger-grid, and a cursor-following
 * spotlight that reveals the cleartext ledger hidden underneath.
 * The privacy story as an interaction: everything is there, you just
 * can't see it without standing in the right place.
 *
 * Performance: the spotlight is a CSS radial-gradient mask whose
 * position is written straight to the DOM inside a lerped rAF loop -
 * no canvas, no per-frame data URLs, no React re-renders.
 */

const SPOTLIGHT_R = 260;

// Cleartext rows the spotlight uncovers, the demo ledger, repeated.
const CLEAR_ROWS = [
  { ref: "INV-2026-0341", flow: "A → B", amount: "120,000.00", settled: false },
  { ref: "INV-2026-1187", flow: "B → C", amount: "95,000.00", settled: true },
  { ref: "PO-88213", flow: "C → A", amount: "150,000.00", settled: false },
  { ref: "INV-2026-0398", flow: "A → C", amount: "40,000.00", settled: true },
  { ref: "CR-2026-077", flow: "B → A", amount: "25,000.00", settled: false },
  { ref: "INV-2026-1204", flow: "C → B", amount: "30,000.00", settled: true },
];

const SPOTLIGHT_MASK = `radial-gradient(circle ${SPOTLIGHT_R}px at ${SPOTLIGHT_R}px ${SPOTLIGHT_R}px, rgba(255,255,255,1) 0%, rgba(255,255,255,1) 40%, rgba(255,255,255,0.75) 60%, rgba(255,255,255,0.4) 75%, rgba(255,255,255,0.12) 88%, rgba(255,255,255,0) 100%)`;

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const revealRef = useRef<HTMLDivElement>(null);
  const mouse = useRef({ x: -9999, y: -9999 });
  const smooth = useRef({ x: -9999, y: -9999 });
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const section = sectionRef.current;
    const reveal = revealRef.current;
    if (!section || !reveal || reduceMotion) return;
    // Spotlight is a hover effect, skip entirely on touch devices.
    if (!window.matchMedia("(hover: hover)").matches) return;

    const onMove = (e: MouseEvent) => {
      const rect = section.getBoundingClientRect();
      mouse.current.x = e.clientX - rect.left;
      mouse.current.y = e.clientY - rect.top;
      // First movement: snap the trail start to the cursor.
      if (smooth.current.x < -9000) {
        smooth.current.x = mouse.current.x;
        smooth.current.y = mouse.current.y;
      }
    };
    const onLeave = () => {
      mouse.current = { x: -9999, y: -9999 };
      smooth.current = { x: -9999, y: -9999 };
      reveal.style.setProperty("mask-position", "-9999px -9999px");
      reveal.style.setProperty("-webkit-mask-position", "-9999px -9999px");
    };

    let raf = 0;
    const tick = () => {
      if (mouse.current.x > -9000) {
        smooth.current.x += (mouse.current.x - smooth.current.x) * 0.1;
        smooth.current.y += (mouse.current.y - smooth.current.y) * 0.1;
        const pos = `${smooth.current.x - SPOTLIGHT_R}px ${smooth.current.y - SPOTLIGHT_R}px`;
        reveal.style.setProperty("mask-position", pos);
        reveal.style.setProperty("-webkit-mask-position", pos);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    section.addEventListener("mousemove", onMove, { passive: true });
    section.addEventListener("mouseleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      section.removeEventListener("mousemove", onMove);
      section.removeEventListener("mouseleave", onLeave);
    };
  }, [reduceMotion]);

  return (
    <section
      ref={sectionRef}
      id="overview"
      className="relative flex min-h-[100dvh] items-end overflow-hidden bg-ink"
    >
      {/* ledger grid, hairlines every 56px, faded out toward the top right */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(215,226,234,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(215,226,234,0.045) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(ellipse 90% 80% at 30% 75%, black 35%, transparent 100%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 90% 80% at 30% 75%, black 35%, transparent 100%)",
        }}
      />
      {/* one quiet mint breath behind the copy, static, no animation */}
      <div
        aria-hidden="true"
        className="absolute bottom-[-20%] left-[-10%] h-[70%] w-[60%] rounded-full opacity-[0.07]"
        style={{
          background:
            "radial-gradient(circle, #38E1A4 0%, transparent 65%)",
        }}
      />

      {/* the spotlight reveal: cleartext ledger, visible only inside a
          soft circle trailing the cursor */}
      <div
        ref={revealRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[2]"
        style={{
          maskImage: SPOTLIGHT_MASK,
          WebkitMaskImage: SPOTLIGHT_MASK,
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
          maskSize: `${SPOTLIGHT_R * 2}px ${SPOTLIGHT_R * 2}px`,
          WebkitMaskSize: `${SPOTLIGHT_R * 2}px ${SPOTLIGHT_R * 2}px`,
          maskPosition: "-9999px -9999px",
          WebkitMaskPosition: "-9999px -9999px",
        }}
      >
        {/* brighter grid inside the beam */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(215,226,234,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(215,226,234,0.14) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
        {/* the cleartext book, confined to the hero's empty right half
            so revealed rows never collide with the headline */}
        <div className="figures absolute inset-y-0 right-0 hidden w-[42%] flex-col justify-evenly pl-8 pr-12 text-xs lg:flex xl:pr-20">
          {Array.from({ length: 2 }).flatMap((_, block) =>
            CLEAR_ROWS.map((row, i) => (
              <div
                key={`${block}-${i}`}
                className="flex items-baseline justify-between gap-6"
              >
                <span className="text-frost/55">{row.ref}</span>
                <span className="text-frost/70">{row.flow}</span>
                <span className="text-frost/85">{row.amount}</span>
                <span
                  className={
                    row.settled ? "text-settled" : "text-frost/45"
                  }
                >
                  {row.settled ? "SETTLED" : "OPEN"}
                </span>
              </div>
            )),
          )}
        </div>
      </div>

      {/* content, bottom-left */}
      <div className="relative z-10 w-full max-w-[90%] px-6 pb-14 pt-32 sm:max-w-xl md:px-10 lg:max-w-2xl">
        <p
          className="eyebrow opacity-0 animate-fade-up"
          style={{ animationDelay: "0.2s" }}
        >
          Multilateral netting · Canton Network
        </p>

        <h1
          className="mt-4 text-[clamp(2.6rem,6vw,5.2rem)] font-medium leading-[1.04] tracking-[-0.025em] text-frost opacity-0 animate-fade-up"
          style={{ animationDelay: "0.35s" }}
        >
          Settle everything.
          <br />
          Reveal <span className="accent-word">nothing</span>.
        </h1>

        <p
          className="mt-5 max-w-[46ch] text-[clamp(0.95rem,1.5vw,1.2rem)] leading-relaxed text-frost/65 opacity-0 animate-fade-up"
          style={{ animationDelay: "0.5s" }}
        >
          Confidential settlement, atomic in USDCx.
          Counterparties see nothing.
        </p>

        <div
          className="mt-8 flex flex-wrap items-center gap-4 opacity-0 animate-fade-up"
          style={{ animationDelay: "0.65s" }}
        >
          <PrimaryCTAButton href="/app">Launch demo</PrimaryCTAButton>
          <GhostButton href="#how-it-works">How it works</GhostButton>
        </div>

        <p
          className="figures mt-8 text-xs tracking-wide text-frost/40 opacity-0 animate-fade-up"
          style={{ animationDelay: "0.8s" }}
        >
          460,000.00 gross&ensp;→&ensp;45,000.00 settled&ensp;·&ensp;Σ nets =
          0&ensp;·&ensp;one atomic transaction
        </p>
      </div>
    </section>
  );
}
