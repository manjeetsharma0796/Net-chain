"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, Lock } from "lucide-react";

/**
 * The hero's signature element: a settlement instruction rendered as
 * the document a treasurer would actually recognize — a clearing
 * confirmation. Rows you are party to are legible; counterparty rows
 * are redaction bars. The card loops the product's whole story:
 * six gross obligations collapse to two net legs and settle atomically.
 * Figures match the demo ledger exactly.
 */

type Phase = "gross" | "net";

const GROSS_ROWS: { ref: string; flow: string; amount: string; redacted?: boolean }[] = [
  { ref: "INV-2026-0341", flow: "A → B", amount: "120,000.00" },
  { ref: "PO-88213", flow: "C → A", amount: "150,000.00" },
  { ref: "", flow: "", amount: "", redacted: true },
  { ref: "INV-2026-0398", flow: "A → C", amount: "40,000.00" },
  { ref: "", flow: "", amount: "", redacted: true },
  { ref: "CR-2026-077", flow: "B → A", amount: "25,000.00" },
];

const NET_ROWS = [
  { flow: "C → A", amount: "15,000.00" },
  { flow: "C → B", amount: "30,000.00" },
];

function RedactedRow() {
  return (
    <div
      className="flex items-center gap-3 px-4 py-[9px]"
      aria-label="Redacted obligation — you are not a party to this contract"
    >
      <Lock size={11} className="shrink-0 text-privacy/70" aria-hidden="true" />
      <span className="h-2 w-24 rounded-sm bg-frost/[0.13]" />
      <span className="h-2 w-10 rounded-sm bg-frost/[0.13]" />
      <span className="ml-auto h-2 w-20 rounded-sm bg-frost/[0.13]" />
    </div>
  );
}

export default function SettlementCard({
  className = "",
}: {
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("gross");

  useEffect(() => {
    if (reduceMotion) return;
    const timer = setInterval(
      () => setPhase((p) => (p === "gross" ? "net" : "gross")),
      4200,
    );
    return () => clearInterval(timer);
  }, [reduceMotion]);

  const showNet = reduceMotion || phase === "net";

  return (
    <div
      className={`figures w-full max-w-[420px] rounded-2xl border border-frost/[0.12] bg-[#101314] text-[13px] shadow-[0_24px_80px_rgba(0,0,0,0.55)] ${className}`}
      role="img"
      aria-label="Animated settlement instruction: six gross obligations, two of them redacted, net to two settlement legs and settle atomically"
    >
      {/* document header */}
      <div className="flex items-center justify-between border-b border-frost/[0.08] px-4 py-3">
        <span className="text-[10px] tracking-[0.22em] text-frost/45">
          SETTLEMENT INSTRUCTION
        </span>
        <span className="text-[10px] text-frost/35">cycle-2026-07-A</span>
      </div>

      {/* viewer line — explains the redactions */}
      <div className="flex items-center justify-between border-b border-frost/[0.08] px-4 py-2 text-[10px] text-frost/40">
        <span>viewer: aurora::1220f8a2…</span>
        <span className="text-privacy/80">2 of 6 rows not disclosed</span>
      </div>

      {/* body: gross ledger ⇄ net legs */}
      <div className="min-h-[218px]">
        <AnimatePresence mode="wait" initial={false}>
          {!showNet ? (
            <motion.div
              key="gross"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45 }}
              className="divide-y divide-frost/[0.05] py-1"
            >
              {GROSS_ROWS.map((row, i) =>
                row.redacted ? (
                  <RedactedRow key={i} />
                ) : (
                  <div key={i} className="flex items-center gap-3 px-4 py-[9px]">
                    <span className="w-[104px] shrink-0 text-frost/50">
                      {row.ref}
                    </span>
                    <span className="text-frost/75">{row.flow}</span>
                    <span className="ml-auto text-frost/90">{row.amount}</span>
                  </div>
                ),
              )}
            </motion.div>
          ) : (
            <motion.div
              key="net"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45 }}
              className="px-4 py-3"
            >
              <p className="pb-2 text-[10px] tracking-[0.18em] text-frost/40">
                NETTED — 6 OBLIGATIONS → 2 LEGS
              </p>
              <div className="divide-y divide-frost/[0.05] rounded-lg border border-frost/[0.09]">
                {NET_ROWS.map((leg) => (
                  <div
                    key={leg.flow}
                    className="flex items-center gap-3 px-3.5 py-2.5"
                  >
                    <span className="text-frost/75">{leg.flow}</span>
                    <span className="ml-auto text-frost/90">{leg.amount}</span>
                    <CheckCircle2
                      size={13}
                      className="text-settled"
                      aria-hidden="true"
                    />
                  </div>
                ))}
              </div>
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.4 }}
                className="mt-3 flex items-center justify-between rounded-lg border border-settled/25 bg-settled/[0.06] px-3.5 py-2.5"
              >
                <span className="text-settled">SETTLED · ATOMIC</span>
                <span className="text-[10px] text-frost/45">
                  tx 0x81c4…9e2f
                </span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* document footer — the arithmetic that makes the pitch */}
      <div className="flex items-center justify-between border-t border-frost/[0.08] px-4 py-3 text-[10px] text-frost/40">
        <span>gross 460,000.00</span>
        <span>net 45,000.00</span>
        <span className="text-settled/80">−90.2%</span>
      </div>
    </div>
  );
}
