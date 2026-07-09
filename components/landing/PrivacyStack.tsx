"use client";

import { useRef } from "react";
import { Eye, EyeOff, Landmark, Lock, ShieldCheck, Workflow } from "lucide-react";
import FadeIn from "@/components/motion/FadeIn";
import { StickyStackCard } from "@/components/motion/StickyStack";

/* ------------------------------------------------------------------ */
/* Mini diagram panels (pure CSS/SVG — no external imagery)           */
/* ------------------------------------------------------------------ */

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`glass-card flex flex-col justify-center gap-2.5 rounded-2xl p-5 ${className}`}
    >
      {children}
    </div>
  );
}

function LedgerRow({ redacted, label }: { redacted?: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-frost/10 px-3 py-2">
      {redacted ? (
        <Lock size={13} className="shrink-0 text-privacy" aria-hidden="true" />
      ) : (
        <Eye size={13} className="shrink-0 text-settled" aria-hidden="true" />
      )}
      {redacted ? (
        <span
          className="h-2.5 flex-1 rounded bg-frost/15"
          aria-label="redacted contract"
        />
      ) : (
        <span className="figures text-xs text-frost/80">{label}</span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cards                                                              */
/* ------------------------------------------------------------------ */

const CARDS = [
  {
    title: "Counterparties are blind",
    body: "Each company is party only to its own contracts. Enforced by the ledger, not hidden by the UI.",
    Icon: EyeOff,
    visuals: (
      <>
        <div className="flex w-full flex-col gap-4 md:w-[40%]">
          <Panel>
            <p className="text-[10px] uppercase tracking-widest text-frost/50">
              Company A&apos;s ledger view
            </p>
            <LedgerRow label="A → B · 120,000.00" />
            <LedgerRow label="C → A · 150,000.00" />
            <LedgerRow redacted label="" />
          </Panel>
          <Panel>
            <p className="text-[10px] uppercase tracking-widest text-frost/50">
              Query: B ↔ C contract
            </p>
            <p className="figures text-xs text-rejected">
              CONTRACT_NOT_FOUND
            </p>
          </Panel>
        </div>
        <Panel className="min-h-[240px] w-full items-center md:w-[60%]">
          <EyeOff size={44} className="text-privacy" aria-hidden="true" />
          <p className="text-center text-sm font-light text-frost/60">
            One cycle, three disjoint projections.
          </p>
        </Panel>
      </>
    ),
  },
  {
    title: "A known, authorized coordinator",
    body: "The operator sees just enough to compute the net — atomic, auditable, policy-bounded.",
    Icon: Landmark,
    visuals: (
      <>
        <div className="flex w-full flex-col gap-4 md:w-[40%]">
          <Panel>
            <p className="text-[10px] uppercase tracking-widest text-frost/50">
              Operator scope
            </p>
            <LedgerRow label="observer: 6 obligations" />
            <LedgerRow label="output: 3 net positions" />
          </Panel>
          <Panel>
            <p className="text-[10px] uppercase tracking-widest text-frost/50">
              Bounded by
            </p>
            <p className="figures text-xs text-frost/80">
              TreasuryPolicy · audit log
            </p>
          </Panel>
        </div>
        <Panel className="min-h-[240px] w-full items-center md:w-[60%]">
          <Workflow size={44} className="text-settled" aria-hidden="true" />
          <p className="text-center text-sm font-light text-frost/60">
            Every step on-ledger, reconstructable.
          </p>
        </Panel>
      </>
    ),
  },
  {
    title: "Honest claim vs. future work",
    body: "We claim counterparty blindness and atomic settlement. Operator-blind netting (MPC/ZK) is future work.",
    Icon: ShieldCheck,
    visuals: (
      <>
        <div className="flex w-full flex-col gap-4 md:w-[40%]">
          <Panel>
            <p className="text-[10px] uppercase tracking-widest text-settled">
              Claimed · demoed
            </p>
            <LedgerRow label="counterparty blindness" />
            <LedgerRow label="atomic settlement" />
          </Panel>
          <Panel>
            <p className="text-[10px] uppercase tracking-widest text-pending">
              Future work
            </p>
            <p className="figures text-xs text-frost/60">
              operator-blind netting (MPC / ZK)
            </p>
          </Panel>
        </div>
        <Panel className="min-h-[240px] w-full items-center md:w-[60%]">
          <ShieldCheck size={44} className="text-frost/70" aria-hidden="true" />
          <p className="text-center text-sm font-light text-frost/60">
            Claims scoped on purpose.
          </p>
        </Panel>
      </>
    ),
  },
];

export default function PrivacyStack() {
  const containerRef = useRef<HTMLElement>(null);

  return (
    <section
      id="privacy"
      ref={containerRef}
      className="relative z-10 -mt-10 rounded-t-[48px] bg-ink px-5 pb-40 pt-24 md:px-10"
    >
      <div className="mx-auto max-w-5xl">
        <FadeIn>
          <p className="eyebrow">The privacy model</p>
          <h2 className="brand-heading mt-4 text-[clamp(2.1rem,4.5vw,3.5rem)] font-medium leading-tight tracking-[-0.02em]">
            Who sees <span className="accent-word">what</span>
          </h2>
        </FadeIn>

        <div className="mt-16 flex flex-col gap-10">
          {CARDS.map((card, i) => (
            <StickyStackCard
              key={card.title}
              index={i}
              total={CARDS.length}
              containerRef={containerRef}
              className="p-7 md:p-12"
            >
              <div className="mb-8 flex items-start gap-4">
                <card.Icon
                  size={28}
                  className="mt-1 shrink-0 text-privacy"
                  aria-hidden="true"
                />
                <div>
                  <h3 className="text-xl font-semibold tracking-[-0.01em] md:text-3xl">
                    {card.title}
                  </h3>
                  <p className="mt-3 max-w-2xl leading-relaxed text-frost/65">
                    {card.body}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-4 md:flex-row">
                {card.visuals}
              </div>
            </StickyStackCard>
          ))}
        </div>
      </div>
    </section>
  );
}
