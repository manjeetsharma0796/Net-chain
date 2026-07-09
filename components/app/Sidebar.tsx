"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  GitMerge,
  LayoutDashboard,
  Scale,
  ShieldCheck,
  Zap,
} from "lucide-react";

const NAV = [
  { href: "/app", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/app/obligations", label: "Obligations", Icon: FileText },
  { href: "/app/privacy-check", label: "Privacy Check", Icon: ShieldCheck },
  { href: "/app/cycle", label: "Netting Cycle", Icon: GitMerge },
  { href: "/app/settlement", label: "Settlement", Icon: Zap },
  { href: "/app/policy", label: "Policy", Icon: Scale },
];

/**
 * App navigation. Vertical rail on desktop; horizontal scrollable tab
 * row on small screens.
 */
export default function Sidebar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="App navigation"
      className="flex shrink-0 gap-1 overflow-x-auto border-b border-frost/10 px-3 py-2 lg:w-60 lg:flex-col lg:overflow-visible lg:border-b-0 lg:border-r lg:px-4 lg:py-6"
    >
      {NAV.map(({ href, label, Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-[44px] shrink-0 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "bg-frost/10 text-frost"
                : "text-frost/55 hover:bg-frost/[0.05] hover:text-frost"
            }`}
          >
            <Icon size={17} aria-hidden="true" />
            <span className="whitespace-nowrap">{label}</span>
            {active && (
              <span
                aria-hidden="true"
                className="ml-auto hidden h-1.5 w-1.5 rounded-full bg-settled lg:block"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
