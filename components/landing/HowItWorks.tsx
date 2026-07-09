"use client";

import FadeIn from "@/components/motion/FadeIn";

const STEPS = [
  {
    name: "Dashboard",
    description: "Live Canton network stats via the Scan API.",
  },
  {
    name: "Onboard funds",
    description: "USD in as USDCx through Circle xReserve.",
  },
  {
    name: "Ingest obligations",
    description: "Drop an invoice — the agent puts it on-ledger.",
  },
  {
    name: "Run a netting cycle",
    description: "Each party gets one net figure. Only theirs.",
  },
  {
    name: "Atomic settlement",
    description: "Every net leg clears in one transaction, or none do.",
  },
  {
    name: "Withdraw",
    description: "USDCx back to USDC on Ethereum.",
  },
];

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="relative z-0 rounded-t-[48px] bg-white px-5 py-28 text-[#0C0C0C] md:px-10"
    >
      <div className="mx-auto max-w-6xl">
        <FadeIn>
          <p className="figures text-[0.7rem] uppercase tracking-[0.22em] text-[#0C0C0C]/45">
            Six steps, one seam
          </p>
          <h2 className="mt-4 text-[clamp(2.1rem,4.5vw,3.5rem)] font-medium leading-tight tracking-[-0.02em]">
            From invoice to <span className="accent-word">settled</span>
          </h2>
        </FadeIn>

        <ol className="mt-16">
          {STEPS.map((step, i) => (
            <FadeIn key={step.name} delay={i * 0.1}>
              <li className="grid grid-cols-1 gap-2 border-t border-[#0C0C0C]/15 py-10 last:border-b md:grid-cols-[minmax(120px,1fr)_2fr_3fr] md:gap-8">
                <span
                  className="figures text-4xl font-light text-[#0C0C0C]/20 md:text-6xl"
                  aria-hidden="true"
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="self-center text-xl font-semibold tracking-[-0.01em] md:text-2xl">
                  {step.name}
                </h3>
                <p className="max-w-prose self-center leading-relaxed text-[#0C0C0C]/65">
                  {step.description}
                </p>
              </li>
            </FadeIn>
          ))}
        </ol>
      </div>
    </section>
  );
}
