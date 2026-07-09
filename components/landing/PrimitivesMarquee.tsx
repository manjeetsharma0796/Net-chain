"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Two scroll-linked marquee rows moving in opposite directions. Each
 * tile names a Canton primitive NetChain builds on. Translation is
 * driven directly by scroll position (passive listener), tiles are
 * tripled so the rows never run out.
 */

interface Primitive {
  name: string;
  /** Real brand mark, only where one exists — no placeholder icons. */
  logoSrc?: string;
  logoAlt?: string;
}

const PRIMITIVES: Primitive[] = [
  { name: "Atomic DvP" },
  { name: "Sub-transaction privacy" },
  { name: "Global Synchronizer" },
  { name: "CIP-56 tokens" },
  { name: "USDCx settlement", logoSrc: "/logos/usdc.svg", logoAlt: "USDC" },
  { name: "Policy-bound agents" },
  { name: "Per-party ledger views" },
  { name: "On-ledger audit" },
  {
    name: "xReserve → Ethereum",
    logoSrc: "/logos/eth.svg",
    logoAlt: "Ethereum",
  },
  { name: "Known-entity identity" },
  { name: "In-house-bank model" },
];

function Tile({ name, logoSrc, logoAlt }: Primitive) {
  return (
    <div className="glass-card flex h-[150px] w-[300px] shrink-0 flex-col justify-between rounded-2xl p-6">
      {logoSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoSrc} alt={logoAlt ?? name} className="h-6 w-6" />
      ) : (
        <span
          aria-hidden="true"
          className="figures text-[10px] tracking-[0.2em] text-frost/30"
        >
          CANTON
        </span>
      )}
      <h3 className="text-lg font-medium tracking-[-0.01em]">{name}</h3>
    </div>
  );
}

export default function PrimitivesMarquee() {
  const sectionRef = useRef<HTMLElement>(null);
  const rowARef = useRef<HTMLDivElement>(null);
  const rowBRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  // Scroll-linked translation written straight to the DOM inside a
  // rAF — no React state, so scrolling never re-renders the tiles.
  useEffect(() => {
    if (reduceMotion) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const el = sectionRef.current;
      if (!el || !rowARef.current || !rowBRef.current) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      const shift = (window.scrollY - top + window.innerHeight) * 0.3;
      rowARef.current.style.transform = `translateX(${-720 - shift}px)`;
      rowBRef.current.style.transform = `translateX(${-2200 + shift}px)`;
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [reduceMotion]);

  const row = [...PRIMITIVES, ...PRIMITIVES, ...PRIMITIVES];
  const half = Math.ceil(row.length / 2);

  return (
    <section
      ref={sectionRef}
      aria-label="Canton primitives NetChain builds on"
      className="overflow-hidden py-24"
    >
      {/* section brand header */}
      <div className="mx-auto mb-12 flex max-w-6xl flex-wrap items-end justify-between gap-4 px-5 md:px-10">
        <div>
          <p className="eyebrow">Infrastructure</p>
          <div className="mt-3 flex items-baseline gap-3">
            <span className="text-2xl font-medium tracking-[-0.02em] text-frost/85">
              Built on
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logos/canton-white.svg"
              alt="Canton Network"
              className="h-7 w-auto translate-y-[3px] md:h-8"
            />
          </div>
        </div>
        <p className="figures text-xs text-frost/40">
          canton.network · Global Synchronizer mainnet
        </p>
      </div>

      <div className="space-y-5">
      <div
        ref={rowARef}
        className="flex gap-5"
        style={{ transform: "translateX(-720px)", willChange: "transform" }}
      >
        {row.slice(0, half).map((p, i) => (
          <Tile key={`r1-${i}`} {...p} />
        ))}
      </div>
      <div
        ref={rowBRef}
        className="flex gap-5"
        style={{ transform: "translateX(-2200px)", willChange: "transform" }}
      >
        {row.slice(half).map((p, i) => (
          <Tile key={`r2-${i}`} {...p} />
        ))}
      </div>
      </div>
    </section>
  );
}
