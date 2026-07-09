"use client";

import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, FileUp, ScanLine } from "lucide-react";
import { extractInvoice, ExtractedInvoice } from "@/lib/api";
import { useNetChain } from "@/lib/store";

interface InvoiceDropzoneProps {
  /** Called with the mock-OCR result once "extraction" finishes. */
  onExtracted: (result: ExtractedInvoice, fileName: string) => void;
}

/**
 * The agent's front door: drop an invoice (PDF/image) and a mocked
 * extraction runs — fake OCR delay with a scanline animation — then the
 * parsed fields are handed to the review form.
 */
export default function InvoiceDropzone({ onExtracted }: InvoiceDropzoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [scanningFile, setScanningFile] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const currentPartyId = useNetChain((s) => s.currentPartyId);
  const pushToast = useNetChain((s) => s.pushToast);

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file || scanningFile) return;
      if (!/\.(pdf|png|jpe?g|webp)$/i.test(file.name)) {
        pushToast("error", "Drop a PDF or image invoice (pdf, png, jpg, webp).");
        return;
      }
      setScanningFile(file.name);
      const result = await extractInvoice(currentPartyId);
      setScanningFile(null);
      onExtracted(result, file.name);
    },
    [currentPartyId, onExtracted, pushToast, scanningFile],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload an invoice for agent extraction. Drag and drop a PDF or image, or press Enter to browse."
      onClick={() => !scanningFile && inputRef.current?.click()}
      onKeyDown={(e) =>
        (e.key === "Enter" || e.key === " ") && inputRef.current?.click()
      }
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFile(e.dataTransfer.files[0]);
      }}
      className={`relative min-h-[190px] cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed p-8 text-center transition-colors duration-200 ${
        dragOver
          ? "border-accent bg-accent/10"
          : "border-frost/25 bg-frost/[0.03] hover:border-frost/45 hover:bg-frost/[0.05]"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.webp"
        className="sr-only"
        onChange={(e) => handleFile(e.target.files?.[0] ?? undefined)}
      />

      <AnimatePresence mode="wait">
        {scanningFile ? (
          <motion.div
            key="scanning"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-3"
            aria-live="polite"
          >
            {/* scanline sweep */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-transparent via-accent/20 to-transparent"
              style={{ animation: "scanline 1.4s ease-in-out infinite" }}
            />
            <ScanLine size={34} className="text-accent" aria-hidden="true" />
            <p className="text-sm font-medium">
              Agent is reading{" "}
              <span className="figures text-accent">{scanningFile}</span>…
            </p>
            <p className="text-xs text-frost/50">
              extracting amount, counterparty, due date
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-3"
          >
            <FileUp size={34} className="text-frost/50" aria-hidden="true" />
            <p className="text-sm font-medium">
              Drop an invoice — the treasury agent takes it from here
            </p>
            <p className="flex items-center gap-1.5 text-xs text-frost/50">
              <Bot size={13} aria-hidden="true" />
              PDF · PNG · JPG — extraction is mocked for the demo
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
