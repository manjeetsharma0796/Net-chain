"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, Lock, SearchX, Terminal } from "lucide-react";
import PageHeader from "@/components/app/PageHeader";
import FadeIn from "@/components/motion/FadeIn";
import GhostButton from "@/components/ui/GhostButton";
import MoneyValue from "@/components/ui/MoneyValue";
import StatusPill from "@/components/ui/StatusPill";
import { getAllObligationsLive, getObligationsFor, queryContract } from "@/lib/ledger";
import { shortHash } from "@/lib/format";
import { partyById, useNetChain } from "@/lib/store";
import { Obligation, PrivacyError } from "@/lib/types";

/**
 * The money shot: proves that the current party's ledger projection
 * excludes every contract it is not a stakeholder on. The right panel
 * queries a foreign contract directly and shows the ledger's refusal.
 */
export default function PrivacyCheckPage() {
  const currentPartyId = useNetChain((s) => s.currentPartyId);
  const party = partyById(currentPartyId);

  // Ground truth: every Obligation with its REAL contract id (operator ACS).
  const [all, setAll] = useState<Obligation[]>([]);
  // The subset the current party may actually see (its per-party projection),
  // keyed strictly on the real contractId so the join matches the live ids.
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [queryState, setQueryState] = useState<
    | { phase: "idle" }
    | { phase: "querying"; contractId: string }
    | { phase: "denied"; error: PrivacyError }
  >({ phase: "idle" });

  useEffect(() => {
    let live = true;
    setLoading(true);
    setFailed(false);
    setQueryState({ phase: "idle" });
    Promise.all([
      getAllObligationsLive(),
      getObligationsFor(currentPartyId, []),
    ]).then(([groundTruth, visible]) => {
      if (!live) return;
      if (!groundTruth) {
        setFailed(true);
        setAll([]);
        setVisibleIds(new Set());
      } else {
        setAll(groundTruth);
        setVisibleIds(new Set(visible.map((o) => o.contractId)));
      }
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [currentPartyId]);

  const foreign = all.filter(
    (o) => o.obligor !== currentPartyId && o.obligee !== currentPartyId,
  );

  const attemptForeignQuery = async () => {
    const target = foreign[0];
    if (!target) return;
    setQueryState({ phase: "querying", contractId: target.contractId });
    try {
      await queryContract(currentPartyId, target.contractId, all);
    } catch (e) {
      if (e instanceof PrivacyError) {
        setQueryState({ phase: "denied", error: e });
        return;
      }
      throw e;
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Privacy Check"
        subtitle={`${party.name}'s projection vs. what the ledger hides.`}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* left: your projection */}
        <FadeIn>
          <section
            aria-label="Your ledger projection"
            className="glass-card flex h-full flex-col rounded-2xl p-6"
          >
            <div className="mb-5 flex items-center gap-2.5">
              <Eye size={18} className="text-settled" aria-hidden="true" />
              <h2 className="text-sm font-semibold uppercase tracking-widest">
                {party.shortName}&apos;s projection
              </h2>
            </div>

            <ul className="space-y-2.5">
              {loading &&
                Array.from({ length: 4 }).map((_, i) => (
                  <li
                    key={i}
                    className="h-14 animate-pulse rounded-xl bg-frost/[0.06]"
                  />
                ))}
              {!loading && failed && (
                <li
                  role="alert"
                  className="rounded-xl border border-rejected/40 bg-rejected/[0.07] px-4 py-3 text-sm text-frost/70"
                >
                  Could not read the ledger projection. The validator did not
                  respond, so nothing is shown.
                </li>
              )}
              {!loading && !failed && all.length === 0 && (
                <li className="rounded-xl border border-frost/15 px-4 py-3 text-sm text-frost/60">
                  No obligations on the ledger yet.
                </li>
              )}
              {!loading &&
                all.map((o) => {
                  const canSee = visibleIds.has(o.contractId);
                  return (
                    <li
                      key={o.contractId}
                      className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                        canSee
                          ? "border-frost/15"
                          : "border-privacy/25 bg-privacy/[0.06]"
                      }`}
                    >
                      {canSee ? (
                        <>
                          <Eye
                            size={14}
                            className="shrink-0 text-settled"
                            aria-hidden="true"
                          />
                          <span className="figures flex-1 truncate text-xs text-frost/70">
                            {shortHash(o.contractId, 10, 6)}
                          </span>
                          <span className="text-xs text-frost/80">
                            {partyById(o.obligor).shortName} →{" "}
                            {partyById(o.obligee).shortName}
                          </span>
                          <MoneyValue amount={o.amount} className="text-xs" />
                        </>
                      ) : (
                        <>
                          <Lock
                            size={14}
                            className="shrink-0 text-privacy"
                            aria-hidden="true"
                          />
                          <span
                            className="h-2.5 flex-1 rounded bg-frost/15"
                            aria-label="Contract not in your projection, parties and amount are not disclosed"
                          />
                          <StatusPill status="private" label="Not disclosed" />
                        </>
                      )}
                    </li>
                  );
                })}
            </ul>
          </section>
        </FadeIn>

        {/* right: the refused query */}
        <FadeIn delay={0.1}>
          <section
            aria-label="Foreign contract query"
            className="glass-card flex h-full flex-col rounded-2xl p-6"
          >
            <div className="mb-5 flex items-center gap-2.5">
              <Terminal size={18} className="text-privacy" aria-hidden="true" />
              <h2 className="text-sm font-semibold uppercase tracking-widest">
                Query a foreign contract
              </h2>
            </div>

            <p className="text-sm text-frost/70">
              Fetch a contract between the other two parties.
            </p>

            <div className="mt-5">
              <GhostButton
                onClick={attemptForeignQuery}
                disabled={queryState.phase === "querying" || foreign.length === 0}
              >
                <SearchX size={14} aria-hidden="true" />
                {queryState.phase === "querying"
                  ? "Querying ledger…"
                  : "Fetch foreign contract"}
              </GhostButton>
            </div>

            <div className="mt-6 flex-1" aria-live="polite">
              <AnimatePresence mode="wait">
                {queryState.phase === "querying" && (
                  <motion.div
                    key="querying"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="rounded-xl border border-frost/15 p-4"
                  >
                    <p className="figures text-xs text-frost/60">
                      GET /v1/contracts/{shortHash(queryState.contractId, 10, 6)}
                    </p>
                    <p className="figures mt-2 animate-pulse text-xs text-frost/40">
                      awaiting ledger response…
                    </p>
                  </motion.div>
                )}
                {queryState.phase === "denied" && (
                  <motion.div
                    key="denied"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    role="alert"
                    className="rounded-xl border border-rejected/40 bg-rejected/[0.07] p-5"
                  >
                    <div className="flex items-center gap-2">
                      <Lock size={15} className="text-rejected" aria-hidden="true" />
                      <p className="text-sm font-semibold uppercase tracking-wider text-rejected">
                        You cannot access this contract
                      </p>
                    </div>
                    <p className="figures mt-3 break-all text-xs leading-relaxed text-frost/70">
                      {queryState.error.message}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>
        </FadeIn>
      </div>
    </div>
  );
}
