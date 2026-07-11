"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { PARTIES } from "@/lib/mock/data";
import { partyById, useNetChain } from "@/lib/store";
import { shortHash } from "@/lib/format";

/**
 * The mock-auth control: choosing a company re-scopes every read in
 * the app to that party's ledger projection. This is how counterparty
 * privacy is demoed live.
 */
export default function PartySwitcher({
  compact = false,
}: {
  compact?: boolean;
}) {
  const currentPartyId = useNetChain((s) => s.currentPartyId);
  const setParty = useNetChain((s) => s.setParty);
  const pushToast = useNetChain((s) => s.pushToast);
  // Subscribe to partyLabels so the switcher re-renders with sandbox tenant names.
  useNetChain((s) => s.partyLabels);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const current = partyById(currentPartyId);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Logged in as ${current.name}. Switch party`}
        className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-full border border-frost/20 px-3.5 py-2 text-sm transition-colors hover:border-frost/40 hover:bg-frost/5"
      >
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: current.color }}
        />
        <span className="font-medium">
          {compact ? current.shortName : current.name}
        </span>
        <ChevronDown
          size={14}
          className={`text-frost/50 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            aria-label="Switch logged-in party"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="glass-card absolute right-0 top-[calc(100%+8px)] z-50 w-72 rounded-2xl bg-ink/95 p-1.5"
          >
            {PARTIES.map((p) => (
              <li key={p.id}>
                <button
                  role="option"
                  aria-selected={p.id === currentPartyId}
                  onClick={() => {
                    setParty(p.id);
                    setOpen(false);
                    if (p.id !== currentPartyId) {
                      pushToast(
                        "info",
                        `Now viewing the ledger as ${partyById(p.id).name}, all reads re-scoped.`,
                      );
                    }
                  }}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-frost/[0.07]"
                >
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{partyById(p.id).name}</span>
                    <span className="figures block text-[11px] text-frost/40">
                      {shortHash(p.ledgerId, 14, 4)}
                    </span>
                  </span>
                  {p.id === currentPartyId && (
                    <Check size={14} className="text-settled" aria-hidden="true" />
                  )}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
