"use client";

import { ArrowLeftRight, Ban, Bot, Check, RefreshCw, ShieldAlert, X } from "lucide-react";
import FadeIn from "@/components/motion/FadeIn";

/**
 * The evidence layer: what a judge can go verify against the deployed
 * package, agent-usability via the MCP server, the competitive gap, and
 * an honest scope note on the settlement asset. Sits between the thesis
 * (About) and the walkthrough (HowItWorks).
 */

const PROOFS = [
  {
    Icon: Ban,
    title: "Real per-party privacy",
    body: "A company gets CONTRACT_NOT_FOUND on a contract it isn't party to. Enforced at the ledger node, not masked in the UI.",
  },
  {
    Icon: ArrowLeftRight,
    title: "Atomic all-or-nothing settlement",
    body: "Every net leg moves in one Canton transaction, or none does. A forced abort moves zero funds.",
  },
  {
    Icon: ShieldAlert,
    title: "A non-bypassable policy cap",
    body: "An over-cap settle is rejected inside the transaction. No caller, human or agent, can route around it.",
  },
  {
    Icon: RefreshCw,
    title: "A live contract upgrade",
    body: "v1.0.0 to v1.0.1, a settlement-correctness fix, applied to a running contract. The demo stayed live through it.",
  },
];

const COMPARISON = [
  {
    who: "Netting incumbents",
    detail: "Kyriba, Coprocess/GTreasury, SAP IHC, Ripple Treasury",
    private: false,
    privateNote: "No, conventional access control",
    atomic: false,
    atomicNote: "No, instruction file then a separate execution step",
  },
  {
    who: "DLT settlement",
    detail: "Partior, Fnality, Kinexys",
    private: false,
    privateNote: "No, bilateral or permissioned visibility",
    atomic: true,
    atomicNote: "Yes, bilaterally",
  },
  {
    who: "NetChain",
    detail: "Confidential N-party netting",
    private: true,
    privateNote: "Yes, Canton per-party projection",
    atomic: true,
    atomicNote: "Yes, across the full N-party net",
  },
];

/** Slim reinforcement band, straight under the hero, before the marquee. */
export function ThesisStrip() {
  return (
    <FadeIn>
      <div className="border-y border-frost/10 bg-ink px-5 py-6 text-center md:px-10">
        <p className="figures text-[0.8rem] tracking-wide text-frost/70 md:text-sm">
          Confidential multilateral netting, atomic settlement, on Canton.
          <span className="mx-2 text-frost/25">&middot;</span>
          <span className="text-accent">AI proposes</span>, the ledger disposes.
        </p>
      </div>
    </FadeIn>
  );
}

export default function Proof() {
  return (
    <section id="proof" className="relative px-5 py-32 md:px-10">
      <div className="mx-auto max-w-6xl">
        <FadeIn>
          <p className="eyebrow">Verifiable, live</p>
          <h2 className="brand-heading mt-4 text-[clamp(2.1rem,4.5vw,3.5rem)] font-medium leading-tight tracking-[-0.02em]">
            Not <span className="accent-word">slideware</span>
          </h2>
          <p className="mt-5 max-w-2xl leading-relaxed text-frost/65">
            Deployed live on the Canton Devnet, 5N Sandbox validator, Protocol Version 35. Each
            claim below is reproducible against the running package, not a mockup.
          </p>
        </FadeIn>

        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PROOFS.map((p, i) => (
            <FadeIn key={p.title} delay={i * 0.08}>
              <div className="glass-card flex h-full flex-col gap-4 rounded-2xl p-6">
                <p.Icon size={24} className="text-accent" aria-hidden="true" />
                <h3 className="text-base font-semibold tracking-[-0.01em]">{p.title}</h3>
                <p className="text-sm leading-relaxed text-frost/60">{p.body}</p>
              </div>
            </FadeIn>
          ))}
        </div>

        {/* agent usability, the Track 3 straddle */}
        <FadeIn delay={0.15} className="mt-8">
          <div className="glass-card flex flex-col gap-6 rounded-2xl p-7 md:flex-row md:items-center md:justify-between md:p-9">
            <div className="flex items-start gap-4 md:max-w-xl">
              <Bot size={28} className="mt-1 shrink-0 text-privacy" aria-hidden="true" />
              <div>
                <h3 className="text-lg font-semibold tracking-[-0.01em] md:text-xl">
                  AI proposes, the ledger disposes.
                </h3>
                <p className="mt-2 leading-relaxed text-frost/65">
                  NetChain ships an MCP server, so any AI agent can record obligations, run a
                  netting cycle, and attempt settlement through the same on-ledger flow the app
                  uses. Every write is bounded by each party&apos;s on-ledger TreasuryPolicy cap.
                  Track 1, private DeFi and capital markets, straddling Track 3, agentic commerce.
                </p>
              </div>
            </div>
            <p className="figures shrink-0 rounded-lg border border-rejected/30 bg-rejected/5 px-4 py-3 text-xs leading-relaxed text-rejected">
              agent: settle 250,000 USDCx
              <br />
              ledger: REJECTED, over maxSettlementPerCycle
            </p>
          </div>
        </FadeIn>

        {/* the competitive gap */}
        <FadeIn delay={0.2} className="mt-24">
          <p className="eyebrow">The gap in the market</p>
          <h3 className="mt-4 text-2xl font-medium tracking-[-0.01em] md:text-3xl">
            Two camps, <span className="accent-word">neither</span> does both
          </h3>
          <div className="glass-card mt-8 overflow-x-auto rounded-2xl">
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-frost/10">
                  <th scope="col" className="p-5 font-medium text-frost/50">
                    <span className="sr-only">Platform</span>
                  </th>
                  <th scope="col" className="p-5 font-medium text-frost/50">
                    Net positions private
                  </th>
                  <th scope="col" className="p-5 font-medium text-frost/50">
                    Settlement atomic
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr
                    key={row.who}
                    className={`border-b border-frost/10 last:border-b-0 ${
                      row.who === "NetChain" ? "bg-accent/[0.06]" : ""
                    }`}
                  >
                    <th scope="row" className="p-5 align-top font-semibold">
                      {row.who}
                      <p className="mt-1 text-xs font-normal text-frost/45">{row.detail}</p>
                    </th>
                    <td className="p-5 align-top">
                      <span className="flex items-center gap-2">
                        {row.private ? (
                          <Check size={16} className="shrink-0 text-settled" aria-hidden="true" />
                        ) : (
                          <X size={16} className="shrink-0 text-rejected" aria-hidden="true" />
                        )}
                        <span className="text-frost/70">{row.privateNote}</span>
                      </span>
                    </td>
                    <td className="p-5 align-top">
                      <span className="flex items-center gap-2">
                        {row.atomic ? (
                          <Check size={16} className="shrink-0 text-settled" aria-hidden="true" />
                        ) : (
                          <X size={16} className="shrink-0 text-rejected" aria-hidden="true" />
                        )}
                        <span className="text-frost/70">{row.atomicNote}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-frost/35">
            A thesis demonstrated on a hackathon Devnet, not a production claim.
          </p>
        </FadeIn>

        {/* honest scope: settlement asset */}
        <FadeIn delay={0.25} className="mt-10">
          <p className="max-w-3xl text-sm leading-relaxed text-frost/45">
            Settlement asset, honestly scoped: NetChain settles a placeholder Cash token today.
            Moving the same Settle choice onto a CIP-56 asset like USDCx is a scoped adapter, not a
            rearchitecture, and it isn&apos;t live yet. We aren&apos;t claiming real USDCx.
          </p>
        </FadeIn>
      </div>
    </section>
  );
}
