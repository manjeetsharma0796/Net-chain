"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useNetChain } from "@/lib/store";

const KIND_STYLES = {
  success: { Icon: CheckCircle2, accent: "text-settled border-settled/40" },
  error: { Icon: XCircle, accent: "text-rejected border-rejected/40" },
  info: { Icon: Info, accent: "text-privacy border-privacy/40" },
} as const;

/**
 * Global toast outlet — mount once in the app layout. aria-live so
 * screen readers announce without stealing focus.
 */
export default function Toaster() {
  const toasts = useNetChain((s) => s.toasts);
  const dismiss = useNetChain((s) => s.dismissToast);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-6 right-6 z-[110] flex w-[min(380px,calc(100vw-3rem))] flex-col gap-2"
    >
      <AnimatePresence>
        {toasts.map((t) => {
          const { Icon, accent } = KIND_STYLES[t.kind];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ duration: 0.2 }}
              className={`glass-card pointer-events-auto flex items-start gap-3 rounded-2xl border bg-ink/95 p-4 ${accent}`}
            >
              <Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p className="flex-1 text-sm text-frost">{t.message}</p>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="cursor-pointer rounded p-0.5 text-frost/50 hover:text-frost"
              >
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
