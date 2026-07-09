"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PartySwitcher from "@/components/PartySwitcher";
import PrimaryCTAButton from "@/components/ui/PrimaryCTAButton";

const LINKS = [
  { label: "Overview", href: "#overview" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Privacy", href: "#privacy" },
  { label: "Demo", href: "/app" },
];

/**
 * Fixed nav floating over the hero's 3D scene — transparent at the top
 * of the page, solid ink once the user scrolls into the content.
 */
export default function TopNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 flex items-center justify-between gap-4 px-5 py-4 transition-colors duration-300 md:px-10 opacity-0 animate-fade-in ${
        scrolled
          ? "border-b border-frost/10 bg-ink/85 backdrop-blur-md"
          : "border-b border-transparent bg-transparent"
      }`}
      style={{ animationDelay: "0.1s" }}
    >
      <Link
        href="/"
        className="text-lg font-bold tracking-[-0.02em] text-frost"
      >
        Net<span className="text-accent">Chain</span>
      </Link>

      <nav aria-label="Primary" className="hidden items-center gap-8 lg:flex">
        {LINKS.map((l) => (
          <Link
            key={l.label}
            href={l.href}
            className="text-[13px] font-medium text-frost/65 transition-colors hover:text-frost"
          >
            {l.label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-3">
        <div className="hidden sm:block">
          <PartySwitcher compact />
        </div>
        <PrimaryCTAButton href="/app" className="!min-h-[40px] !px-5 !py-2">
          Launch Demo
        </PrimaryCTAButton>
      </div>
    </header>
  );
}
