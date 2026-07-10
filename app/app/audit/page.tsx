"use client";

import { useMemo } from "react";
import { ClipboardList, Download, Landmark, Sigma } from "lucide-react";
import PageHeader from "@/components/app/PageHeader";
import FadeIn from "@/components/motion/FadeIn";
import DataTable, { Column } from "@/components/ui/DataTable";
import GhostButton from "@/components/ui/GhostButton";
import MoneyValue from "@/components/ui/MoneyValue";
import StatusPill from "@/components/ui/StatusPill";
import { downloadCsv, toSettledLegsCsv } from "@/lib/export";
import { shortHash } from "@/lib/format";
import { partyById, useNetChain } from "@/lib/store";
import { Obligation, SettlementLeg } from "@/lib/types";

/**
 * Audit trail: gross obligations -> net position -> settled legs, scoped to
 * the current party. This is the reporting view finance/compliance teams
 * pull for transfer-pricing and reconciliation documentation; it reads
 * the same store the rest of the app writes, no separate data path.
 */
export default function AuditPage() {
  const currentPartyId = useNetChain((s) => s.currentPartyId);
  const obligations = useNetChain((s) => s.obligations);
  const cycleId = useNetChain((s) => s.cycleId);
  const netPositions = useNetChain((s) => s.netPositions);
  const legs = useNetChain((s) => s.legs);
  const txHash = useNetChain((s) => s.txHash);
  const party = partyById(currentPartyId);

  const inScopeObligations = useMemo(
    () =>
      obligations.filter(
        (o) =>
          (o.obligor === currentPartyId || o.obligee === currentPartyId) &&
          (o.status === "netted" || o.status === "settled"),
      ),
    [obligations, currentPartyId],
  );

  const myPosition = netPositions?.find((p) => p.party === currentPartyId) ?? null;
  const grossPayable = inScopeObligations
    .filter((o) => o.obligor === currentPartyId)
    .reduce((sum, o) => sum + o.amount, 0);
  const grossReceivable = inScopeObligations
    .filter((o) => o.obligee === currentPartyId)
    .reduce((sum, o) => sum + o.amount, 0);

  const myLegs = useMemo(
    () =>
      legs.filter(
        (l) =>
          (l.from === currentPartyId || l.to === currentPartyId) &&
          l.status === "settled",
      ),
    [legs, currentPartyId],
  );

  const obligationColumns: Column<Obligation>[] = [
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
      key: "status",
      header: "Status",
      render: (o) => (
        <StatusPill status={o.status === "settled" ? "settled" : "netted"} />
      ),
    },
  ];

  const legColumns: Column<SettlementLeg>[] = [
    {
      key: "from",
      header: "From",
      render: (l) => partyById(l.from).shortName,
    },
    {
      key: "to",
      header: "To",
      render: (l) => partyById(l.to).shortName,
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      render: (l) => <MoneyValue amount={l.amount} />,
    },
    {
      key: "ref",
      header: "Settlement ref",
      render: () => (
        <span className="figures text-xs text-frost/60">
          {txHash ? shortHash(txHash, 10, 4) : "n/a"}
        </span>
      ),
    },
  ];

  const exportCsv = () => {
    const csv = toSettledLegsCsv(myLegs, { cycleId, txHash: txHash ?? "" });
    downloadCsv(`${cycleId}-${currentPartyId}-audit.csv`, csv);
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Audit"
        subtitle={`${cycleId}: tracing ${party.name}'s gross obligations to the computed net position and the settled legs that cleared them.`}
      />

      <FadeIn>
        <section aria-label="Gross obligations in scope">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-frost/60">
            <ClipboardList size={16} className="text-frost/50" aria-hidden="true" />
            Gross obligations
          </h2>
          <DataTable
            columns={obligationColumns}
            rows={inScopeObligations}
            rowKey={(o) => o.id}
            caption={`Obligations swept into ${cycleId} for ${party.name}`}
            emptyMessage="No obligations have been netted for this party yet. Run the netting cycle first."
          />
        </section>
      </FadeIn>

      <FadeIn delay={0.1} className="mt-8">
        <section
          aria-label="Net position"
          className="glass-card rounded-2xl p-6"
        >
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-frost/60">
            <Sigma size={16} className="text-frost/50" aria-hidden="true" />
            Net position
          </h2>
          {myPosition ? (
            <div className="flex flex-wrap items-end gap-8">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-frost/45">
                  Net this cycle
                </p>
                <MoneyValue amount={myPosition.net} signed className="text-xl" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-frost/45">
                  Gross payable
                </p>
                <MoneyValue amount={grossPayable} className="text-sm" />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-frost/45">
                  Gross receivable
                </p>
                <MoneyValue amount={grossReceivable} className="text-sm" />
              </div>
            </div>
          ) : (
            <p className="py-4 text-sm text-frost/50">
              No net position yet. Run the netting cycle to compute it.
            </p>
          )}
        </section>
      </FadeIn>

      <FadeIn delay={0.15} className="mt-8">
        <section aria-label="Settled legs">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-frost/60">
              <Landmark size={16} className="text-frost/50" aria-hidden="true" />
              Settled legs
            </h2>
            {myLegs.length > 0 && (
              <GhostButton
                onClick={exportCsv}
                className="!min-h-[34px] !px-3.5 !text-xs"
              >
                <Download size={13} aria-hidden="true" />
                Export CSV
              </GhostButton>
            )}
          </div>
          <DataTable
            columns={legColumns}
            rows={myLegs}
            rowKey={(l) => l.id}
            caption={`Settled legs for ${party.name} in ${cycleId}`}
            emptyMessage="No settled legs yet. Settle the cycle to complete the audit trail."
          />
        </section>
      </FadeIn>
    </div>
  );
}
