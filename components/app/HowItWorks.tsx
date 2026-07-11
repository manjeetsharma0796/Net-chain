"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  ClipboardList,
  FileText,
  GitMerge,
  HelpCircle,
  ShieldCheck,
  X,
  Zap,
} from "lucide-react";

const SEEN_KEY = "netchain-how-it-works-seen";

const STEPS = [
  {
    Icon: FileText,
    title: "Record obligations",
    body: "Log who owes whom on the Obligations page.",
    hrefs: [{ href: "/app/obligations", label: "Obligations" }],
    note: "You only ever see contracts you're a party to, the Privacy Check page proves it.",
    noteHref: "/app/privacy-check",
    noteIcon: ShieldCheck,
  },
  {
    Icon: GitMerge,
    title: "Net the cycle",
    body: "The operator opens a netting cycle and computes each party's single net position on the Netting Cycle page.",
    hrefs: [{ href: "/app/cycle", label: "Netting Cycle" }],
  },
  {
    Icon: Zap,
    title: "Settle atomically",
    body: "All balances move in one transaction, or none do. An over-cap net is blocked on-ledger by the Treasury Policy.",
    hrefs: [
      { href: "/app/settlement", label: "Settlement" },
      { href: "/app/policy", label: "Policy" },
    ],
  },
  {
    Icon: ClipboardList,
    title: "Audit and export",
    body: "Review settled legs and export them as CSV or ISO 20022 on the Audit page.",
    hrefs: [{ href: "/app/audit", label: "Audit" }],
  },
];

/**
 * Dismissible "how it works" affordance for first-time users. A small
 * FAB opens a focus-trapped overlay walking through the 4-step flow,
 * tied to the actual nav. Auto-opens once (localStorage), reopenable
 * any time from the button.
 */
export default function HowItWorks() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (localStorage.getItem(SEEN_KEY)) return;
    localStorage.setItem(SEEN_KEY, "1");
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="How NetChain works"
        title="How NetChain works"
        className="fixed bottom-6 left-6 z-40 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-frost/20 bg-ink/95 text-frost/70 shadow-lg backdrop-blur-sm transition-colors hover:border-frost/40 hover:text-frost"
      >
        <HelpCircle size={20} aria-hidden="true" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="how-it-works-title"
              tabIndex={-1}
              className="glass-card w-full max-w-2xl rounded-3xl bg-ink/95 p-6 md:p-8"
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <p className="eyebrow mb-2">Guided walkthrough</p>
                  <h2
                    id="how-it-works-title"
                    className="text-xl font-semibold tracking-[-0.01em] text-frost md:text-2xl"
                  >
                    How NetChain works
                  </h2>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close dialog"
                  className="cursor-pointer rounded-full p-2 text-frost/60 transition-colors hover:bg-frost/10 hover:text-frost"
                >
                  <X size={18} />
                </button>
              </div>

              <ol className="flex flex-col gap-5">
                {STEPS.map(({ Icon, title, body, hrefs, note, noteHref, noteIcon: NoteIcon }, i) => (
                  <li key={title} className="flex gap-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-frost/20 bg-frost/5 text-frost/70">
                      <Icon size={16} aria-hidden="true" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-frost">
                        <span className="figures text-frost/40">{i + 1}. </span>
                        {title}
                      </p>
                      <p className="mt-1 text-sm text-frost/60">{body}</p>
                      {note && (
                        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-privacy/90">
                          {NoteIcon && <NoteIcon size={13} aria-hidden="true" />}
                          {note}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {hrefs.map(({ href, label }) => (
                          <Link
                            key={href}
                            href={href}
                            onClick={() => setOpen(false)}
                            className="inline-flex items-center gap-1 rounded-full border border-frost/20 px-3 py-1 text-xs font-medium text-frost/70 transition-colors hover:border-frost/40 hover:text-frost"
                          >
                            {label}
                            <ArrowRight size={11} aria-hidden="true" />
                          </Link>
                        ))}
                        {noteHref && (
                          <Link
                            href={noteHref}
                            onClick={() => setOpen(false)}
                            className="inline-flex items-center gap-1 rounded-full border border-privacy/30 px-3 py-1 text-xs font-medium text-privacy transition-colors hover:border-privacy/60"
                          >
                            Privacy Check
                            <ArrowRight size={11} aria-hidden="true" />
                          </Link>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>

              <p className="mt-6 flex items-start gap-2 border-t border-frost/10 pt-4 text-xs text-frost/50">
                <Bot size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                The whole flow is also drivable by an AI agent through the NetChain MCP server. AI proposes, the ledger disposes.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
