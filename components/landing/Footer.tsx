import Link from "next/link";
import PrimaryCTAButton from "@/components/ui/PrimaryCTAButton";

export default function Footer() {
  return (
    <footer className="border-t border-frost/10 px-5 py-16 md:px-10">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-10 md:flex-row md:items-end">
        <div className="max-w-md space-y-4">
          <Link
            href="/"
            className="text-lg font-bold tracking-[-0.02em] text-frost"
          >
            Net<span className="text-accent">Chain</span>
          </Link>
          <p className="text-sm leading-relaxed text-frost/60">
            One net payment per cycle. Counterparties stay blind.
          </p>
          <p className="text-xs uppercase tracking-wider text-frost/40">
            Track 1 · Private DeFi &nbsp;+&nbsp; Track 3 · Agentic Commerce
          </p>
        </div>

        <div className="flex flex-col items-start gap-5 md:items-end">
          <span className="inline-flex items-center gap-2.5 rounded-full border border-frost/20 px-5 py-2.5">
            <span className="text-xs uppercase tracking-widest text-frost/60">
              Built on
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logos/canton-white.svg"
              alt="Canton Network"
              className="h-4 w-auto opacity-90"
            />
          </span>
          <PrimaryCTAButton href="/app">Launch demo</PrimaryCTAButton>
        </div>
      </div>
    </footer>
  );
}
