"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Bot, PenLine, Plus } from "lucide-react";
import PageHeader from "@/components/app/PageHeader";
import InvoiceDropzone from "@/components/InvoiceDropzone";
import FadeIn from "@/components/motion/FadeIn";
import DataTable, { Column } from "@/components/ui/DataTable";
import GhostButton from "@/components/ui/GhostButton";
import Modal from "@/components/ui/Modal";
import MoneyValue from "@/components/ui/MoneyValue";
import PrimaryCTAButton from "@/components/ui/PrimaryCTAButton";
import StatusPill from "@/components/ui/StatusPill";
import { ExtractedInvoice, getObligationsFor } from "@/lib/ledger";
import { createObligationLive } from "@/lib/ledger";
import { formatDate, shortHash } from "@/lib/format";
import { partyById, useNetChain } from "@/lib/store";
import { Obligation, PartyId } from "@/lib/types";
import { PARTIES } from "@/lib/mock/data";

/* ------------------------------------------------------------------ */
/* Obligation entry form — used for both agent review and manual entry */
/* ------------------------------------------------------------------ */

interface DraftFields {
  counterparty: PartyId | "";
  direction: "payable" | "receivable";
  amount: string;
  reference: string;
  dueDate: string;
}

const EMPTY_DRAFT: DraftFields = {
  counterparty: "",
  direction: "payable",
  amount: "",
  reference: "",
  dueDate: "",
};

function ObligationForm({
  initial,
  source,
  submitLabel,
  onDone,
}: {
  initial: DraftFields;
  source: "agent" | "manual";
  submitLabel: string;
  onDone: () => void;
}) {
  const currentPartyId = useNetChain((s) => s.currentPartyId);
  const addObligation = useNetChain((s) => s.addObligation);
  const logActivity = useNetChain((s) => s.logActivity);
  const pushToast = useNetChain((s) => s.pushToast);
  const [fields, setFields] = useState<DraftFields>(initial);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setFields(initial), [initial]);

  const set = (patch: Partial<DraftFields>) =>
    setFields((f) => ({ ...f, ...patch }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const amount = Number(fields.amount);
    if (!fields.counterparty) return setError("Choose a counterparty.");
    if (!amount || amount <= 0)
      return setError("Amount must be a positive number.");
    if (!fields.reference.trim()) return setError("Add an invoice reference.");
    if (!fields.dueDate) return setError("Set a due date.");
    setError(null);

    const obligor =
      fields.direction === "payable" ? currentPartyId : fields.counterparty;
    const obligee =
      fields.direction === "payable" ? fields.counterparty : currentPartyId;
    const created = addObligation({
      obligor,
      obligee,
      amount,
      currency: "USDCx",
      reference: fields.reference.trim(),
      dueDate: fields.dueDate,
      source,
    });
    logActivity({
      actor: source === "agent" ? "agent" : currentPartyId,
      kind: "obligation",
      message: `${source === "agent" ? "Agent extracted invoice and created" : "Manual entry created"} Obligation ${created.amount.toLocaleString()} USDCx (${partyById(obligor).shortName} → ${partyById(obligee).shortName})`,
    });
    // Live path: also create the Obligation on-ledger (null when the flag is
    // off / ledger unconfigured — the local demo obligation still stands).
    const updateId = await createObligationLive({
      obligor,
      obligee,
      amount,
      reference: fields.reference.trim(),
      dueDate: fields.dueDate,
    });
    pushToast(
      "success",
      updateId
        ? `Obligation created on-ledger · tx ${shortHash(updateId, 10, 4)}`
        : `Obligation created · ${shortHash(created.contractId, 10, 4)}`,
    );
    onDone();
  };

  const inputClasses =
    "w-full rounded-xl border border-frost/20 bg-ink px-3.5 py-2.5 text-sm text-frost placeholder:text-frost/30 focus:border-accent focus:outline-none";

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block text-xs font-medium uppercase tracking-wider text-frost/60">
          Counterparty <span aria-hidden="true">*</span>
          <select
            value={fields.counterparty}
            onChange={(e) => set({ counterparty: e.target.value as PartyId })}
            className={`mt-1.5 ${inputClasses}`}
            required
          >
            <option value="" disabled>
              Select…
            </option>
            {PARTIES.filter((p) => p.id !== currentPartyId).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-medium uppercase tracking-wider text-frost/60">
          Direction <span aria-hidden="true">*</span>
          <select
            value={fields.direction}
            onChange={(e) =>
              set({ direction: e.target.value as DraftFields["direction"] })
            }
            className={`mt-1.5 ${inputClasses}`}
          >
            <option value="payable">We pay them (payable)</option>
            <option value="receivable">They pay us (receivable)</option>
          </select>
        </label>

        <label className="block text-xs font-medium uppercase tracking-wider text-frost/60">
          Amount (USDCx) <span aria-hidden="true">*</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            value={fields.amount}
            onChange={(e) => set({ amount: e.target.value })}
            placeholder="0.00"
            className={`mt-1.5 figures ${inputClasses}`}
            required
          />
        </label>

        <label className="block text-xs font-medium uppercase tracking-wider text-frost/60">
          Due date <span aria-hidden="true">*</span>
          <input
            type="date"
            value={fields.dueDate}
            onChange={(e) => set({ dueDate: e.target.value })}
            className={`mt-1.5 figures ${inputClasses}`}
            required
          />
        </label>
      </div>

      <label className="block text-xs font-medium uppercase tracking-wider text-frost/60">
        Reference <span aria-hidden="true">*</span>
        <input
          type="text"
          value={fields.reference}
          onChange={(e) => set({ reference: e.target.value })}
          placeholder="INV-2026-0000 · Description"
          className={`mt-1.5 ${inputClasses}`}
          required
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-rejected">
          {error}
        </p>
      )}

      <PrimaryCTAButton type="submit" className="w-full sm:w-auto">
        <Plus size={15} aria-hidden="true" />
        {submitLabel}
      </PrimaryCTAButton>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export default function ObligationsPage() {
  const currentPartyId = useNetChain((s) => s.currentPartyId);
  const ledger = useNetChain((s) => s.obligations);
  const party = partyById(currentPartyId);

  const [rows, setRows] = useState<Obligation[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualOpen, setManualOpen] = useState(false);
  const [reviewDraft, setReviewDraft] = useState<DraftFields | null>(null);
  const [reviewMeta, setReviewMeta] = useState<{
    fileName: string;
    confidence: number;
  } | null>(null);

  // Party-scoped read — the filter happens in lib/api, not here.
  useEffect(() => {
    let live = true;
    setLoading(true);
    getObligationsFor(currentPartyId, ledger).then((data) => {
      if (!live) return;
      setRows(data);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [currentPartyId, ledger]);

  const onExtracted = useCallback(
    (result: ExtractedInvoice, fileName: string) => {
      setReviewDraft({
        counterparty: result.counterparty,
        direction: "payable",
        amount: String(result.amount),
        reference: result.reference,
        dueDate: result.dueDate,
      });
      setReviewMeta({ fileName, confidence: result.confidence });
    },
    [],
  );

  const columns: Column<Obligation>[] = [
    {
      key: "obligor",
      header: "Obligor",
      render: (o) => (
        <span className={o.obligor === currentPartyId ? "font-semibold" : ""}>
          {partyById(o.obligor).shortName}
        </span>
      ),
    },
    {
      key: "obligee",
      header: "Obligee",
      render: (o) => (
        <span className={o.obligee === currentPartyId ? "font-semibold" : ""}>
          {partyById(o.obligee).shortName}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (o) => <MoneyValue amount={o.amount} />,
    },
    {
      key: "reference",
      header: "Reference",
      render: (o) => <span className="text-frost/70">{o.reference}</span>,
    },
    {
      key: "due",
      header: "Due",
      render: (o) => <span className="figures text-frost/70">{formatDate(o.dueDate)}</span>,
    },
    {
      key: "source",
      header: "Source",
      render: (o) =>
        o.source === "agent" ? (
          <StatusPill status="agent" label="Agent" />
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wide text-frost/50">
            <PenLine size={12} aria-hidden="true" /> Manual
          </span>
        ),
    },
    {
      key: "status",
      header: "Status",
      render: (o) => (
        <StatusPill
          status={
            o.status === "settled"
              ? "settled"
              : o.status === "netted"
                ? "netted"
                : o.status === "rejected"
                  ? "rejected"
                  : "open"
          }
        />
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Obligations"
        subtitle={`Contracts where ${party.name} is obligor or obligee — nothing else exists in your projection.`}
        actions={
          <GhostButton onClick={() => setManualOpen((v) => !v)}>
            <PenLine size={14} aria-hidden="true" />
            Manual entry
          </GhostButton>
        }
      />

      <FadeIn>
        <InvoiceDropzone onExtracted={onExtracted} />
      </FadeIn>

      {manualOpen && (
        <FadeIn className="mt-6">
          <div className="glass-card rounded-2xl p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-frost/60">
              Manual entry — the always-works fallback
            </h2>
            <ObligationForm
              initial={EMPTY_DRAFT}
              source="manual"
              submitLabel="Create obligation"
              onDone={() => setManualOpen(false)}
            />
          </div>
        </FadeIn>
      )}

      <FadeIn delay={0.1} className="mt-8">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(o) => o.id}
          loading={loading}
          caption={`Obligations visible to ${party.name}`}
          emptyMessage="No obligations in your view — drop an invoice above."
        />
      </FadeIn>

      {/* agent extraction review */}
      <Modal
        open={reviewDraft !== null}
        onClose={() => setReviewDraft(null)}
        title="Agent extraction — review"
      >
        {reviewMeta && (
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-privacy/30 bg-privacy/10 px-4 py-3">
            <Bot size={18} className="shrink-0 text-privacy" aria-hidden="true" />
            <p className="text-sm text-frost/85">
              Parsed <span className="figures">{reviewMeta.fileName}</span> at{" "}
              <span className="figures text-privacy">
                {(reviewMeta.confidence * 100).toFixed(0)}%
              </span>{" "}
              confidence. Review before it goes on-ledger.
            </p>
          </div>
        )}
        {reviewDraft && (
          <ObligationForm
            initial={reviewDraft}
            source="agent"
            submitLabel="Create on-ledger obligation"
            onDone={() => setReviewDraft(null)}
          />
        )}
      </Modal>
    </div>
  );
}
