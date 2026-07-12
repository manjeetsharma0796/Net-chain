"use client";

import { FormEvent, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bot,
  Check,
  Gavel,
  Scale,
  ShieldAlert,
  ShieldX,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import PageHeader from "@/components/app/PageHeader";
import FadeIn from "@/components/motion/FadeIn";
import GhostButton from "@/components/ui/GhostButton";
import MoneyValue from "@/components/ui/MoneyValue";
import PrimaryCTAButton from "@/components/ui/PrimaryCTAButton";
import StatusPill from "@/components/ui/StatusPill";
import {
  approveCapLive,
  checkPolicy,
  getCapProposalsLive,
  getPolicyLive,
  proposeCapLive,
  rejectCapLive,
} from "@/lib/ledger";
import { formatTime } from "@/lib/format";
import { AGENT_OVERREACH_AMOUNT, POLICIES } from "@/lib/mock/data";
import { partyById, useNetChain } from "@/lib/store";
import { PartyId } from "@/lib/types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type AttemptPhase = "idle" | "proposing" | "checking" | "rejected";

/**
 * The non-bypassable policy demo: the agent proposes an over-threshold
 * settlement and the on-ledger TreasuryPolicy rejects it, a live,
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
  const [liveCap, setLiveCap] = useState<number | null>(null);

  // Cap governance (maker-checker): proposals list + in-flight flags.
  const [proposals, setProposals] = useState<
    { proposalCid: string; party: PartyId; newCap: number }[]
  >([]);
  const [capInput, setCapInput] = useState("");
  const [proposing, setProposing] = useState(false);
  const [actingCid, setActingCid] = useState<string | null>(null);
  // Bumped after any propose/approve/reject to refetch cap + proposals.
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getPolicyLive(currentPartyId)
      .then((p) => {
        if (!cancelled) setLiveCap(p?.maxSettlementPerCycle ?? null);
      })
      .catch(() => {
        if (!cancelled) setLiveCap(null);
      });
    return () => {
      cancelled = true;
    };
  }, [currentPartyId, refreshTick]);

  useEffect(() => {
    let cancelled = false;
    getCapProposalsLive()
      .then((p) => {
        if (!cancelled) setProposals(p ?? []);
      })
      .catch(() => {
        if (!cancelled) setProposals([]);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  const onPropose = async (e: FormEvent) => {
    e.preventDefault();
    const cap = Number(capInput);
    if (!cap || cap <= 0) return;
    setProposing(true);
    await proposeCapLive({ party: currentPartyId, newCap: cap });
    setCapInput("");
    setProposing(false);
    setRefreshTick((t) => t + 1);
  };

  const onApprove = async (cid: string) => {
    setActingCid(cid);
    await approveCapLive(cid);
    setActingCid(null);
    setRefreshTick((t) => t + 1);
  };

  const onReject = async (cid: string) => {
    setActingCid(cid);
    await rejectCapLive(cid);
    setActingCid(null);
    setRefreshTick((t) => t + 1);
  };

  const isCapLive = liveCap !== null;
  const maxSettlementPerCycle = liveCap ?? policy.maxSettlementPerCycle;

  const runAttempt = async () => {
    setPhase("proposing");
    setRuleFired(null);
    await sleep(1100);
    setPhase("checking");
    const counterparty = policy.allowedCounterparties[0];
    const verdict = await checkPolicy(policy, AGENT_OVERREACH_AMOUNT, counterparty);
    // The mock amount is chosen to always trip a policy rule, but which
    // rule fires depends on the active party's own TreasuryPolicy.
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
      message: `Agent settlement of ${AGENT_OVERREACH_AMOUNT.toLocaleString("en-US")} USDCx REJECTED by ${party.shortName}'s TreasuryPolicy`,
    });
    pushToast("error", "On-ledger policy rejected the agent's settlement.");
  };

  // Only maxSettlementPerCycle exists on the deployed TreasuryPolicy template.
  // The other fields are product-config, not on-ledger yet.
  const rows: { label: string; value: React.ReactNode; illustrative?: boolean }[] = [
    {
      label: "maxSettlementPerCycle",
      value: <MoneyValue amount={maxSettlementPerCycle} />,
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
      illustrative: true,
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
        subtitle={`${party.name}'s TreasuryPolicy lives on the ledger. The agent operates through it, never around it.`}
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
                  <dt className="figures text-xs text-frost/55">
                    {r.label}
                    {r.illustrative && (
                      <span className="ml-2 text-[10px] text-frost/40">
                        · policy metadata
                      </span>
                    )}
                  </dt>
                  <dd className="text-sm">{r.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs font-light leading-relaxed text-frost/50">
              {isCapLive
                ? "maxSettlementPerCycle is read live from the deployed TreasuryPolicy contract."
                : "maxSettlementPerCycle shown here is the configured value, the live ledger read didn't return one."}{" "}
              The other fields are policy metadata, not yet part of the
              deployed contract. In the real system these are assertions
              inside the Daml settlement choice, the transaction fails
              validation before it ever reaches the ledger if any rule is
              violated.
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
              settlement, past a threshold in {party.shortName}&apos;s
              TreasuryPolicy. The policy is on-ledger, so the rejection is not
              a UI guardrail: the agent cannot bypass it. The exact rule that
              fires is shown below, live.
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
                      {AGENT_OVERREACH_AMOUNT.toLocaleString("en-US")} USDCx{"}"}
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

      {/* cap governance, on-ledger maker-checker (four-eyes) */}
      <FadeIn delay={0.2} className="mt-6">
        <section
          aria-label="Cap governance"
          className="glass-card rounded-2xl p-6"
        >
          <div className="mb-1.5 flex items-center gap-2.5">
            <UserCheck size={18} className="text-frost/60" aria-hidden="true" />
            <h2 className="text-sm font-semibold uppercase tracking-widest">
              Cap governance · maker-checker
            </h2>
          </div>
          <p className="mb-5 text-xs font-light leading-relaxed text-frost/50">
            On-ledger four-eyes control over maxSettlementPerCycle. The operator
            must approve. Neither party can change a cap alone (four-eyes).
          </p>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* maker: current party proposes */}
            <form onSubmit={onPropose} className="space-y-3" noValidate>
              <label className="block text-xs font-medium uppercase tracking-wider text-frost/60">
                Propose new cap · {party.shortName}
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  value={capInput}
                  onChange={(e) => setCapInput(e.target.value)}
                  placeholder="0.00"
                  className="figures mt-1.5 w-full rounded-xl border border-frost/20 bg-ink px-3.5 py-2.5 text-sm text-frost placeholder:text-frost/30 focus:border-accent focus:outline-none"
                />
              </label>
              <GhostButton type="submit" disabled={proposing || !capInput}>
                {proposing ? "Proposing…" : "Propose new cap"}
              </GhostButton>
            </form>

            {/* checker: operator approves / rejects pending proposals */}
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-frost/50">
                Pending proposals · operator approves
              </h3>
              {proposals.length === 0 ? (
                <p className="text-xs text-frost/40">
                  No pending cap proposals.
                </p>
              ) : (
                <ul className="space-y-2">
                  {proposals.map((p) => (
                    <li
                      key={p.proposalCid}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-frost/15 bg-black/30 px-3 py-2.5"
                    >
                      <span className="inline-flex items-center gap-1.5 text-xs text-frost/70">
                        {partyById(p.party).shortName} →{" "}
                        <MoneyValue amount={p.newCap} className="text-xs" />
                      </span>
                      <div className="flex flex-wrap gap-2">
                        <GhostButton
                          onClick={() => onApprove(p.proposalCid)}
                          disabled={actingCid === p.proposalCid}
                        >
                          <Check size={13} aria-hidden="true" /> Approve
                        </GhostButton>
                        <GhostButton
                          onClick={() => onReject(p.proposalCid)}
                          disabled={actingCid === p.proposalCid}
                        >
                          <X size={13} aria-hidden="true" /> Reject
                        </GhostButton>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      </FadeIn>
    </div>
  );
}
