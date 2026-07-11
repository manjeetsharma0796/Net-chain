"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  FlaskConical,
  Landmark,
  Undo2,
  Zap,
} from "lucide-react";
import PageHeader from "@/components/app/PageHeader";
import FadeIn from "@/components/motion/FadeIn";
import GhostButton from "@/components/ui/GhostButton";
import MoneyValue from "@/components/ui/MoneyValue";
import PrimaryCTAButton from "@/components/ui/PrimaryCTAButton";
import StatusPill from "@/components/ui/StatusPill";
import { downloadCsv, toSettledLegsCsv } from "@/lib/export";
import { getBalancesLive, newTxHash, settleLive } from "@/lib/ledger";
import { partyById, useNetChain } from "@/lib/store";
import { PartyId } from "@/lib/types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const LEG_PILL = {
  "awaiting-allocation": { status: "pending", label: "Awaiting allocation" },
  allocated: { status: "pending", label: "Allocated" },
  settled: { status: "settled", label: "Settled" },
  reverted: { status: "rejected", label: "Reverted" },
} as const;

/**
 * Allocation → atomic settlement. Every leg flips to Settled in the
 * same commit; with failure injection enabled, the commit aborts and
 * every leg reverts, there is no partial state to show because none
 * ever exists.
 */
export default function SettlementPage() {
  const legs = useNetChain((s) => s.legs);
  const cycleId = useNetChain((s) => s.cycleId);
  const cycleStatus = useNetChain((s) => s.cycleStatus);
  const txHash = useNetChain((s) => s.txHash);
  const setLegStatus = useNetChain((s) => s.setLegStatus);
  const setCycleStatus = useNetChain((s) => s.setCycleStatus);
  const setTxHash = useNetChain((s) => s.setTxHash);
  const applySettlementBalances = useNetChain((s) => s.applySettlementBalances);
  const setBalances = useNetChain((s) => s.setBalances);
  const markObligations = useNetChain((s) => s.markObligations);
  const obligations = useNetChain((s) => s.obligations);
  const logActivity = useNetChain((s) => s.logActivity);
  const pushToast = useNetChain((s) => s.pushToast);

  const [forceFail, setForceFail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [aborted, setAborted] = useState(false);

  const payers = useMemo(
    () => Array.from(new Set(legs.map((l) => l.from))) as PartyId[],
    [legs],
  );
  const allAllocated =
    legs.length > 0 && legs.every((l) => l.status !== "awaiting-allocation");
  const settled = cycleStatus === "settled";

  const allocate = async () => {
    setBusy(true);
    setAborted(false);
    for (const leg of legs) {
      if (leg.status !== "awaiting-allocation") continue;
      await sleep(700);
      setLegStatus([leg.id], "allocated");
      logActivity({
        actor: leg.from,
        kind: "settlement",
        message: `${partyById(leg.from).shortName} allocated ${leg.amount.toLocaleString()} USDCx for ${cycleId}`,
      });
    }
    setBusy(false);
    pushToast("success", "All net obligors have allocated USDCx.");
  };

  const exportCsv = () => {
    const csv = toSettledLegsCsv(legs, { cycleId, txHash: txHash ?? "" });
    downloadCsv(`${cycleId}-settled-legs.csv`, csv);
  };

  const settle = async () => {
    setBusy(true);
    setAborted(false);
    setCycleStatus("settling");
    try {
    await sleep(1600); // the commit window, legs pulse while pending

    if (forceFail) {
      // Atomic abort: nothing settled, everything reverts together.
      setLegStatus("all", "reverted");
      await sleep(900);
      setLegStatus("all", "allocated");
      setCycleStatus("computed");
      setAborted(true);
      logActivity({
        actor: "operator",
        kind: "settlement",
        message: `Settlement for ${cycleId} ABORTED, injected leg failure; all legs reverted, no funds moved`,
      });
      pushToast("error", "Commit aborted, all legs reverted. Nothing moved.");
    } else {
      // Live path: run + Settle the cycle on-ledger for a real update id
      // (null when the flag is off / ledger unconfigured → mock hash).
      const live = await settleLive();
      // Atomic commit: every leg flips in the same instant.
      setLegStatus("all", "settled");
      // Re-read real Account balances from the ledger; fall back to store math.
      const liveBalances = await getBalancesLive();
      if (liveBalances) {
        setBalances(liveBalances);
      } else {
        applySettlementBalances();
      }
      markObligations(
        obligations.filter((o) => o.status === "netted").map((o) => o.id),
        "settled",
      );
      setCycleStatus("settled");
      const hash = live?.updateId ?? newTxHash(cycleId);
      setTxHash(hash);
      logActivity({
        actor: "operator",
        kind: "settlement",
        message: `Cycle ${cycleId} settled atomically, ${legs.length} legs in one DvP transaction`,
      });
      pushToast("success", "Settled. Every leg cleared in one transaction.");
    }
    } catch (e) {
      // Never leave the settle button stuck spinning on a ledger/network error.
      setCycleStatus("computed");
      pushToast("error", `Settlement failed: ${e instanceof Error ? e.message : "unknown error"}`);
    } finally {
      setBusy(false);
    }
  };

  if (legs.length === 0) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader title="Settlement" />
        <div className="glass-card rounded-2xl p-12 text-center">
          <Landmark size={30} className="mx-auto text-frost/40" aria-hidden="true" />
          <p className="mt-4 text-sm text-frost/60">
            No settlement legs yet, run the netting cycle first.
          </p>
          <div className="mt-6 flex justify-center">
            <GhostButton href="/app/cycle">Go to Netting Cycle</GhostButton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Settlement"
        subtitle={`${cycleId}, net obligors allocate USDCx, then every leg clears in one all-or-nothing DvP transaction.`}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_2fr]">
        {/* legs */}
        <FadeIn>
          <section aria-label="Settlement legs" className="glass-card rounded-2xl p-6">
            <h2 className="mb-5 text-sm font-semibold uppercase tracking-widest text-frost/60">
              Net legs · per-leg breakdown
            </h2>
            <ul className="space-y-3">
              {legs.map((leg) => {
                const pill = LEG_PILL[leg.status];
                const committing = cycleStatus === "settling";
                return (
                  <motion.li
                    key={leg.id}
                    animate={
                      committing
                        ? { opacity: [1, 0.55, 1] }
                        : { opacity: 1 }
                    }
                    transition={
                      committing
                        ? { duration: 0.8, repeat: Infinity }
                        : { duration: 0.3 }
                    }
                    className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-4 transition-colors ${
                      leg.status === "settled"
                        ? "border-settled/40 bg-settled/[0.06]"
                        : leg.status === "reverted"
                          ? "border-rejected/40 bg-rejected/[0.06]"
                          : "border-frost/15"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span
                        aria-hidden="true"
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: partyById(leg.from).color }}
                      />
                      {partyById(leg.from).shortName}
                    </span>
                    <ArrowRight size={14} className="text-frost/40" aria-hidden="true" />
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span
                        aria-hidden="true"
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: partyById(leg.to).color }}
                      />
                      {partyById(leg.to).shortName}
                    </span>
                    <MoneyValue amount={leg.amount} className="ml-auto text-sm" />
                    <StatusPill status={pill.status} label={pill.label} />
                  </motion.li>
                );
              })}
            </ul>

            <AnimatePresence>
              {aborted && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  role="alert"
                  className="mt-5 flex items-start gap-3 rounded-xl border border-rejected/40 bg-rejected/[0.07] px-4 py-3.5"
                >
                  <Undo2 size={16} className="mt-0.5 shrink-0 text-rejected" aria-hidden="true" />
                  <p className="text-sm text-frost/85">
                    <span className="font-semibold text-rejected">
                      Transaction aborted.
                    </span>{" "}
                    One leg failed during the commit, so the ledger rejected
                    the whole transaction, every leg reverted, no funds
                    moved. All-or-nothing is the only mode.
                  </p>
                </motion.div>
              )}
              {settled && txHash && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-5 flex items-start gap-3 rounded-xl border border-settled/40 bg-settled/[0.07] px-4 py-3.5"
                >
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-settled" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-settled">
                      Settled atomically
                    </p>
                    <p className="figures mt-1 break-all text-xs text-frost/60">
                      tx {txHash}
                    </p>
                    <div className="mt-3">
                      <GhostButton
                        onClick={exportCsv}
                        className="!min-h-[34px] !px-3.5 !text-xs"
                      >
                        <Download size={13} aria-hidden="true" />
                        Export CSV
                      </GhostButton>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </FadeIn>

        {/* controls */}
        <FadeIn delay={0.1}>
          <section aria-label="Settlement controls" className="glass-card h-fit rounded-2xl p-6">
            <h2 className="mb-5 text-sm font-semibold uppercase tracking-widest text-frost/60">
              Two steps, one commit
            </h2>

            <div className="space-y-5">
              <div className="rounded-xl border border-frost/15 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-frost/70">
                  1 · Allocation
                </p>
                <p className="mt-1.5 text-xs font-light leading-relaxed text-frost/55">
                  Net payers ({payers.map((p) => partyById(p).shortName).join(", ")})
                  lock USDCx against their net position.
                </p>
                <div className="mt-3">
                  <GhostButton
                    onClick={allocate}
                    disabled={busy || allAllocated || settled}
                    className="!min-h-[38px] !px-4 !text-xs"
                  >
                    {allAllocated ? "Allocated ✓" : busy ? "Allocating…" : "Allocate USDCx"}
                  </GhostButton>
                </div>
              </div>

              <div className="rounded-xl border border-frost/15 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-frost/70">
                  2 · Atomic settlement
                </p>
                <p className="mt-1.5 text-xs font-light leading-relaxed text-frost/55">
                  One DvP transaction clears every leg. If any leg fails, the
                  ledger aborts the whole commit.
                </p>

                <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-xs text-frost/70">
                  <input
                    type="checkbox"
                    checked={forceFail}
                    onChange={(e) => setForceFail(e.target.checked)}
                    disabled={settled}
                    className="h-4 w-4 accent-[#FF5C5C]"
                  />
                  <FlaskConical size={13} className="text-rejected" aria-hidden="true" />
                  Inject a leg failure (demo the abort)
                </label>

                <div className="mt-4">
                  <PrimaryCTAButton
                    onClick={settle}
                    disabled={busy || !allAllocated || settled}
                    className="w-full"
                  >
                    <Zap size={15} aria-hidden="true" />
                    {settled
                      ? "Settled"
                      : cycleStatus === "settling"
                        ? "Committing…"
                        : "Settle atomically"}
                  </PrimaryCTAButton>
                </div>
              </div>
            </div>
          </section>
        </FadeIn>
      </div>
    </div>
  );
}
