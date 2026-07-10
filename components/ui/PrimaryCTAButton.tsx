"use client";

import Link from "next/link";
import { ButtonHTMLAttributes, ReactNode } from "react";

interface PrimaryCTAButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  /** Renders as a Next <Link> when provided. */
  href?: string;
  className?: string;
}

/**
 * The single vibrant gradient CTA. One per screen, everything else
 * uses GhostButton.
 */
export default function PrimaryCTAButton({
  children,
  href,
  className = "",
  ...rest
}: PrimaryCTAButtonProps) {
  const classes = `cta-primary inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-full px-7 py-3 text-[15px] font-medium tracking-[-0.01em] hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${className}`;

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
