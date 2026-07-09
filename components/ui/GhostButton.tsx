"use client";

import Link from "next/link";
import { ButtonHTMLAttributes, ReactNode } from "react";

interface GhostButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  href?: string;
  className?: string;
}

/** Outline pill — the secondary action everywhere. */
export default function GhostButton({
  children,
  href,
  className = "",
  ...rest
}: GhostButtonProps) {
  const classes = `inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-full border border-frost/30 px-6 py-2.5 text-[15px] font-medium tracking-[-0.01em] text-frost transition-colors duration-200 hover:border-frost/60 hover:bg-frost/[0.06] disabled:cursor-not-allowed disabled:opacity-40 ${className}`;

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }
  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
}
