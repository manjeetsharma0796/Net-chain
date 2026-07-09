"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bot,
  Gavel,
  Scale,
  ShieldAlert,
  ShieldX,
  Users,
} from "lucide-react";
import PageHeader from "@/components/app/PageHeader";
import FadeIn from "@/components/motion/FadeIn";
import MoneyValue from "@/components/ui/MoneyValue";
import PrimaryCTAButton from "@/components/ui/PrimaryCTAButton";
import StatusPill from "@/components/ui/StatusPill";
import { checkPolicy } from "@/lib/api";
import { formatTime } from "@/lib/format";
import { AGENT_OVERREACH_AMOUNT, POLICIES } from "@/lib/mock/data";
import { partyById, useNetChain } from "@/lib/store";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type AttemptPhase = "idle" | "proposing" | "checking" | "rejected";

/**
 * The non-bypassable policy demo: the agent proposes an over-threshold
 * settlement and the on-ledger TreasuryPolicy rejects it — a live,
 * visible failure state with the exact rule that fired.
 */
export default function PolicyPage() {
  const currentPartyId = useNetChain((s) => s.currentPartyId);
  const policyEvents = useNetChain((s) => s.policyEvents);
  const addPolicyEvent = useNetChain((s) => s.addPolicyEvent);
  const logActivity = useNetChain((s) => s.logActivity);
  const pushToast = useNetChain((s) => s.pushToast);
  const party = partyById(currentPartyId);
  const policy = POLICIES.find((p) => p.party === currentPartyId)!;

  const [phase, setPhase] = useState<AttemptPhase>("idle");
  const [ruleFired, setRuleFired] = useState<string | null>(null);

  const runAttempt = async () => {
    setPhase("proposing");
    setRuleFired(null);
    await sleep(1100);
    setPhase("checking");
    const counterparty = policy.allowedCounterparties[0];
    const verdict = await checkPolicy(policy, AGENT_OVERREACH_AMOUNT, counterparty);
    // The mock amount is chosen to always trip the cycle cap.
    setRuleFired(verdict.ruleFired ?? null);
    setPhase("rejected");
    addPolicyEvent({
      attemptedAmount: AGENT_OVERREACH_AMOUNT,
      verdict: "rejected",
      ruleFired: verdict.ruleFired,
    });
    logActivity({
      actor: "agent",
      kind: "policy",
      message: `Agent settlement of ${AGENT_OVERREACH_AMOUNT.toLocaleString()} USDCx REJECTED by ${party.shortName}'s TreasuryPolicy`,
    });
    pushToast("error", "On-ledger policy rejected the agent's settlement.");
  };

  const rows: { label: string; value: React.ReactNode }[] = [
    {
      label: "maxSettlementPerCycle",
      value: <MoneyValue amount={policy.maxSettlementPerCycle} />,
    },
    {
      label: "allowedCounterparties",
      value: (
        <span className="inline-flex items-center gap-1.5">
          <Users size={13} className="text-frost/50" aria-hidden="true" />
          {policy.allowedCounterparties
            .map((p) => partyById(p).shortName)
            .join(", ")}
        </span>
      ),
    },
    {
      label: "allowedInstrument",
      value: <span className="figures">{policy.allowedInstrument}</span>,
    },
    {
      label: "requiresHumanApprovalAbove",
      value: <MoneyValue amount={policy.requiresHumanApprovalAbove} />,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Treasury Policy"
        subtitle={`${party.name}'s TreasuryPolicy lives on the ledger. The agent operates through it — never around it.`}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* policy panel */}
        <FadeIn>
          <section aria-label="Policy parameters" className="glass-card rounded-2xl p-6">
            <div className="mb-5 flex items-center gap-2.5">
              <Scale size={18} className="text-frost/60" aria-hidden="true" />
              <h2 className="text-sm font-semibold uppercase tracking-widest">
                TreasuryPolicy · {party.shortName}
              </h2>
            </div>
            <dl className="divide-y divide-frost/[0.07]">
              {rows.map((r) => (
                <div
                  key={r.label}
                  className="flex flex-wrap items-center justify-between gap-2 py-3.5"
                >
                  <dt className="figures text-xs text-frost/55">{r.label}</dt>
                  <dd className="text-sm">{r.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs font-light leading-relaxed text-frost/50">
              In the real system these are assertions inside the Daml
              settlement choice — the transaction fails validation before it
              ever reaches the ledger if any rule is violated.
            </p>
          </section>
        </FadeIn>

        {/* rogue agent console */}
        <FadeIn delay={0.1}>
          <section
            aria-label="Agent over-threshold attempt"
            className="glass-card flex flex-col rounded-2xl p-6"
          >
            <div className="mb-5 flex items-center gap-2.5">
              <ShieldAlert size={18} className="text-rejected" aria-hidden="true" />
              <h2 className="text-sm font-semibold uppercase tracking-widest">
                Required demo moment
              </h2>
            </div>

            <p className="text-sm font-light leading-relaxed text-frost/70">
              Make the agent attempt a{" "}
              <MoneyValue amount={AGENT_OVERREACH_AMOUNT} className="text-sm" />{" "}
              settlement — above {party.shortName}&apos;s cycle cap. The policy
              is on-ledger, so the rejection is not a UI guardrail: the agent
              cannot bypass it.
            </p>

            <div className="mt-5">
              <PrimaryCTAButton
                onClick={runAttempt}
                disabled={phase === "proposing" || phase === "checking"}
              >
                <Bot size={15} aria-hidden="true" />
                {phase === "idle" || phase === "rejected"
                  ? "Agent attempts over-threshold settlement"
                  : "Attempt in progress…"}
              </PrimaryCTAButton>
            </div>

            {/* attempt console */}
            <div className="mt-6 min-h-[150px] rounded-xl border border-frost/15 bg-black/40 p-4" aria-live="polite">
              <AnimatePresence mode="wait">
                {phase === "idle" && (
                  <motion.p
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="figures text-xs text-frost/40"
                  >
                    ── agent console idle ──
                  </motion.p>
                )}
                {(phase === "proposing" || phase === "checking") && (
                  <motion.div
                    key="running"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="figures space-y-2 text-xs"
                  >
                    <p className="text-frost/70">
                      agent&gt; propose Settle {"{"}amount:{" "}
                      {AGENT_OVERREACH_AMOUNT.toLocaleString()} USDCx{"}"}
                    </p>
                    <p className={phase === "checking" ? "text-frost/70" : "text-frost/30"}>
                      ledger&gt; validating against TreasuryPolicy…
                    </p>
                    <p className="animate-pulse text-frost/40">▌</p>
                  </motion.div>
                )}
                {phase === "rejected" && (
                  <motion.div
                    key="rejected"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    role="alert"
                    className="space-y-3"
                  >
                    <div className="flex items-center gap-2">
                      <ShieldX size={16} className="text-rejected" aria-hidden="true" />
                      <p className="text-sm font-bold uppercase tracking-wider text-rejected">
                        Rejected on-ledger
                      </p>
                    </div>
                    <p className="figures text-xs leading-relaxed text-frost/75">
                      COMMAND_FAILED: TreasuryPolicy assertion violated
                    </p>
                    {ruleFired && (
                      <p className="figures rounded-lg border border-rejected/30 bg-rejected/[0.08] px-3 py-2 text-xs text-rejected">
                        rule fired → {ruleFired}
                      </p>
                    )}
                    <p className="text-xs font-light text-frost/55">
                      The transaction never reached the ledger. No override
                      flag exists for the agent to set.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* attempt log */}
            {policyEvents.length > 0 && (
              <div className="mt-5">
                <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-frost/50">
                  <Gavel size={13} aria-hidden="true" /> Attempt log
                </h3>
                <ul className="space-y-1.5">
                  {policyEvents.map((e) => (
                    <li
                      key={e.id}
                      className="flex flex-wrap items-center gap-2 text-xs text-frost/60"
                    >
                      <span className="figures">{formatTime(e.at)}</span>
                      <MoneyValue amount={e.attemptedAmount} className="text-xs" />
                      <StatusPill status="rejected" />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </FadeIn>
      </div>
    </div>
  );
}
