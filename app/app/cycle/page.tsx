"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { GitMerge, Lock, Sigma, UserCog, Users } from "lucide-react";
import PageHeader from "@/components/app/PageHeader";
import FadeIn from "@/components/motion/FadeIn";
import GhostButton from "@/components/ui/GhostButton";
import MoneyValue from "@/components/ui/MoneyValue";
import NettingGraph from "@/components/app/NettingGraph";
import NumberTicker from "@/components/ui/NumberTicker";
import PrimaryCTAButton from "@/components/ui/PrimaryCTAButton";
import StatusPill from "@/components/ui/StatusPill";
import { buildSettlementLegs, computeNetPositions } from "@/lib/api";
import { getNetPositionFor, getObligationsFor, runCycleLive } from "@/lib/ledger";
import { PARTY_IDS as ALL_PARTY_IDS } from "@/lib/ledger-map";
import { partyById, useNetChain } from "@/lib/store";
import type { NetPosition, Obligation, PartyId } from "@/lib/types";

const IS_LIVE = process.env.NEXT_PUBLIC_LEDGER_LIVE === "1";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Operator console + party-scoped result. The view toggle is the demo
 * device: as operator you see every net position; as the logged-in
 * party you see exactly one figure, your own.
 */
export default function CyclePage() {
  const currentPartyId = useNetChain((s) => s.currentPartyId);
  const obligations = useNetChain((s) => s.obligations);
  const cycleId = useNetChain((s) => s.cycleId);
  const cycleStatus = useNetChain((s) => s.cycleStatus);
  const netPositions = useNetChain((s) => s.netPositions);
  const setCycleStatus = useNetChain((s) => s.setCycleStatus);
  const setNetPositions = useNetChain((s) => s.setNetPositions);
  const setLegs = useNetChain((s) => s.setLegs);
  const markObligations = useNetChain((s) => s.markObligations);
  const logActivity = useNetChain((s) => s.logActivity);
  const pushToast = useNetChain((s) => s.pushToast);

  // Operator projection: every obligation on the ledger, not just this
  // party's. getObligationsFor is per-party scoped, so fetch it for all
  // three parties and merge; falls back to the mock store when the ledger
  // isn't live (the wrapper already resolves to the mock in that case).
  const [liveObligations, setLiveObligations] = useState<Obligation[] | null>(null);
  useEffect(() => {
    let live = true;
    Promise.all(ALL_PARTY_IDS.map((pid) => getObligationsFor(pid, obligations))).then(
      (lists) => {
        if (!live) return;
        const merged = new Map<string, Obligation>();
        for (const list of lists) for (const o of list) merged.set(o.id, o);
        setLiveObligations(Array.from(merged.values()));
      },
    );
    return () => {
      live = false;
    };
  }, [obligations]);
  const effectiveObligations = liveObligations ?? obligations;

  const openObligations = useMemo(
    () => effectiveObligations.filter((o) => o.status === "open"),
    [effectiveObligations],
  );
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(openObligations.map((o) => o.id)),
  );
  // Real contract ids differ from the store's illustrative ones, so
  // re-seed the selection once the live merge lands.
  useEffect(() => {
    if (liveObligations) {
      setSelected(
        new Set(liveObligations.filter((o) => o.status === "open").map((o) => o.id)),
      );
    }
  }, [liveObligations]);
  const [view, setView] = useState<"operator" | "party">("operator");
  const [liveMyPosition, setLiveMyPosition] = useState<NetPosition | null>(null);

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const runCycle = async () => {
    const inScope = effectiveObligations.filter((o) => selected.has(o.id));
    if (!IS_LIVE && inScope.length < 2) {
      pushToast("error", "Select at least two obligations to net.");
      return;
    }
    setCycleStatus("computing");
    setLiveMyPosition(null);

    try {
      const liveResult = await runCycleLive();

      let positions;
      let usedCycleId = cycleId;
      if (liveResult) {
        positions = liveResult.netPositions;
        usedCycleId = liveResult.cycleId;
        // Fetch this party's position directly from the ledger (real per-party privacy).
        const myPos = await getNetPositionFor(currentPartyId, positions);
        setLiveMyPosition(myPos);
      } else {
        if (inScope.length < 2) {
          setCycleStatus("open");
          pushToast("error", "Select at least two obligations to net.");
          return;
        }
        await sleep(1400);
        positions = computeNetPositions(inScope, cycleId);
      }

      setNetPositions(positions);
      setLegs(buildSettlementLegs(positions));
      markObligations(inScope.map((o) => o.id), "netted");
      setCycleStatus("computed");
      logActivity({
        actor: "operator",
        kind: "cycle",
        message: `Cycle ${usedCycleId} computed${liveResult ? " on-ledger" : ""}, ${positions.filter((p) => p.net !== 0).length} net positions`,
      });
      pushToast(
        "success",
        liveResult
          ? "On-ledger netting complete. Each party reads only their own NetPosition."
          : "Netting cycle computed. Each party sees only its own figure.",
      );
    } catch (e) {
      // Never leave the page stuck in "computing" on a ledger/network error.
      setCycleStatus("open");
      pushToast("error", `Netting cycle failed: ${e instanceof Error ? e.message : "unknown error"}`);
    }
  };

  const inScopeObligations = effectiveObligations.filter((o) => selected.has(o.id));
  const grossTotal = inScopeObligations.reduce((sum, o) => sum + o.amount, 0);
  // Live NetPosition contracts carry no gross fields (mapped to 0 in
  // lib/ledger-map.ts), so gross out/in is derived here from the same
  // in-scope obligations used for grossTotal and computeNetPositions.
  const grossFor = (party: PartyId) =>
    inScopeObligations.reduce(
      (acc, o) => {
        if (o.obligor === party) acc.payable += o.amount;
        if (o.obligee === party) acc.receivable += o.amount;
        return acc;
      },
      { payable: 0, receivable: 0 },
    );
  const netTotal = netPositions
    ? netPositions.reduce((sum, p) => sum + Math.max(0, p.net), 0)
    : null;
  const sumOfNets = netPositions
    ? netPositions.reduce((sum, p) => sum + p.net, 0)
    : null;

  const computed = cycleStatus !== "open" && netPositions !== null;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Netting Cycle"
        subtitle="Compute each party's net position."
        actions={
          <div
            role="group"
            aria-label="Select view"
            className="flex rounded-full border border-frost/20 p-1"
          >
            {(
              [
                { key: "operator", label: "Operator view", Icon: UserCog },
                { key: "party", label: `${partyById(currentPartyId).shortName} view`, Icon: Users },
              ] as const
            ).map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setView(key)}
                aria-pressed={view === key}
                className={`flex min-h-[36px] cursor-pointer items-center gap-2 rounded-full px-4 text-xs font-medium uppercase tracking-wider transition-colors ${
                  view === key
                    ? "bg-frost/15 text-frost"
                    : "text-frost/50 hover:text-frost"
                }`}
              >
                <Icon size={13} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        }
      />

      {view === "operator" ? (
        <>
          <FadeIn>
            <NettingGraph obligations={openObligations} />
          </FadeIn>

          <FadeIn className="mt-6">
            <section
              aria-label="Operator console"
              className="glass-card rounded-2xl p-6"
            >
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <UserCog size={18} className="text-pending" aria-hidden="true" />
                  <h2 className="text-sm font-semibold uppercase tracking-widest">
                    Netting operator console
                  </h2>
                  <span className="rounded-full border border-pending/40 px-2.5 py-0.5 text-[10px] uppercase tracking-widest text-pending">
                    demo access
                  </span>
                </div>
                <p className="figures text-xs text-frost/50">
                  in scope: {selected.size} · gross{" "}
                  {grossTotal.toLocaleString("en-US")} USDCx
                </p>
              </div>

              {openObligations.length === 0 && !computed && (
                <p className="py-6 text-center text-sm text-frost/50">
                  No open obligations, this cycle has already been netted.
                </p>
              )}

              <ul className="space-y-2">
                {openObligations.map((o) => (
                  <li key={o.id}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-frost/10 px-4 py-3 transition-colors hover:bg-frost/[0.04]">
                      <input
                        type="checkbox"
                        checked={selected.has(o.id)}
                        onChange={() => toggle(o.id)}
                        className="h-4 w-4 accent-[#38E1A4]"
                      />
                      <span className="flex-1 text-sm">
                        {partyById(o.obligor).shortName} →{" "}
                        {partyById(o.obligee).shortName}
                        <span className="ml-2 text-xs text-frost/50">
                          {o.reference}
                        </span>
                      </span>
                      <MoneyValue amount={o.amount} className="text-sm" />
                    </label>
                  </li>
                ))}
              </ul>

              {openObligations.length > 0 && (
                <div className="mt-6">
                  <PrimaryCTAButton
                    onClick={runCycle}
                    disabled={cycleStatus === "computing"}
                  >
                    <GitMerge size={15} aria-hidden="true" />
                    {cycleStatus === "computing"
                      ? "Computing net positions…"
                      : "Run netting cycle"}
                  </PrimaryCTAButton>
                </div>
              )}
            </section>
          </FadeIn>

          {computed && (
            <FadeIn className="mt-6">
              <section aria-label="Net positions" className="glass-card rounded-2xl p-6">
                <div className="mb-5 flex items-center gap-2.5">
                  <Sigma size={18} className="text-settled" aria-hidden="true" />
                  <h2 className="text-sm font-semibold uppercase tracking-widest">
                    Net positions, operator output
                  </h2>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {netPositions!.map((p, i) => {
                    const { payable, receivable } = grossFor(p.party);
                    return (
                    <motion.div
                      key={p.party}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.12, duration: 0.4 }}
                      className="rounded-xl border border-frost/15 p-5"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: partyById(p.party).color }}
                        />
                        <p className="text-xs font-semibold uppercase tracking-wider text-frost/70">
                          {partyById(p.party).name}
                        </p>
                      </div>
                      <p
                        className={`mt-3 text-2xl ${
                          p.net > 0
                            ? "text-settled"
                            : p.net < 0
                              ? "text-pending"
                              : "text-frost/60"
                        }`}
                      >
                        <NumberTicker
                          value={Math.abs(p.net)}
                          decimals={2}
                          prefix={p.net > 0 ? "+" : p.net < 0 ? "−" : ""}
                          delay={i * 0.15}
                        />
                        <span className="figures ml-1.5 text-xs opacity-60">
                          USDCx
                        </span>
                      </p>
                      <p className="mt-1 text-[11px] uppercase tracking-wide text-frost/45">
                        {p.net > 0 ? "net receiver" : p.net < 0 ? "net payer" : "flat"}
                      </p>
                      <p className="figures mt-3 text-[11px] text-frost/40">
                        gross out {payable.toLocaleString("en-US")} · gross in{" "}
                        {receivable.toLocaleString("en-US")}
                      </p>
                    </motion.div>
                    );
                  })}
                </div>
                <p className="figures mt-5 text-xs text-frost/55">
                  Σ nets = {sumOfNets?.toLocaleString("en-US")} ·
                  gross {grossTotal.toLocaleString("en-US")} → net{" "}
                  {netTotal?.toLocaleString("en-US")} USDCx ·{" "}
                  {grossTotal > 0 && netTotal !== null
                    ? `${(100 - (netTotal / grossTotal) * 100).toFixed(1)}% compression`
                    : ""}
                </p>
                <div className="mt-5">
                  <GhostButton href="/app/settlement">
                    Continue to settlement
                  </GhostButton>
                </div>
              </section>
            </FadeIn>
          )}
        </>
      ) : (
        /* -------- party-scoped view: one figure only -------- */
        <FadeIn>
          <section
            aria-label="Your net position"
            className="grid grid-cols-1 gap-4 md:grid-cols-3"
          >
          {!computed ? (
            <div className="glass-card col-span-full rounded-2xl p-10 text-center text-sm text-frost/50">
              Cycle not yet computed. Run it from the operator view.
            </div>
          ) : (
            ALL_PARTY_IDS.map((pid) => {
              const mine = pid === currentPartyId;
              // In live mode: my position comes from a direct per-party ledger query
              // (the ledger won't disclose other parties' NetPositions to me at all).
              // In mock mode: read from the store as before.
              const myPos = IS_LIVE
                ? (liveMyPosition ?? netPositions?.find((p) => p.party === pid) ?? null)
                : (netPositions?.find((p) => p.party === pid) ?? null);
              const pos = mine ? myPos : null;

              return (
                <div
                  key={pid}
                  className={`rounded-xl border p-5 ${
                    mine
                      ? "border-settled/40 bg-settled/[0.05]"
                      : "border-privacy/25 bg-privacy/[0.05]"
                  }`}
                >
                  {mine && pos ? (
                    <>
                      <p className="text-xs font-semibold uppercase tracking-wider text-frost/70">
                        {partyById(pid).name}, your position
                        {IS_LIVE && (
                          <span className="ml-2 text-[10px] text-accent/70">· live</span>
                        )}
                      </p>
                      <p
                        className={`mt-3 text-2xl ${
                          pos.net > 0
                            ? "text-settled"
                            : pos.net < 0
                              ? "text-pending"
                              : "text-frost/60"
                        }`}
                      >
                        <NumberTicker
                          value={Math.abs(pos.net)}
                          decimals={2}
                          prefix={pos.net > 0 ? "+" : pos.net < 0 ? "−" : ""}
                        />
                        <span className="figures ml-1.5 text-xs opacity-60">
                          USDCx
                        </span>
                      </p>
                      <p className="mt-1 text-[11px] uppercase tracking-wide text-frost/45">
                        {pos.net > 0 ? "you receive" : pos.net < 0 ? "you pay" : "flat"}{" "}
                        this cycle
                      </p>
                    </>
                  ) : mine ? (
                    <p className="text-xs text-frost/40">Loading your position…</p>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <Lock size={13} className="text-privacy" aria-hidden="true" />
                        <p className="text-xs font-semibold uppercase tracking-wider text-frost/50">
                          Another party
                        </p>
                      </div>
                      <div
                        className="mt-4 h-7 w-32 rounded bg-frost/10"
                        aria-label="Net position not disclosed to you"
                      />
                      <div className="mt-3">
                        <StatusPill status="private" label="Not disclosed" />
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
          </section>
        </FadeIn>
      )}
    </div>
  );
}
