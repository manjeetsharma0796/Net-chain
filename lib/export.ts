/**
 * Settled-legs CSV export, feeds an existing TMS/GL until a native
 * integration exists. Production format is ISO 20022 pain.001 XML;
 * that is future work, not built here.
 */

import { partyById } from "@/lib/store";
import { SettlementLeg } from "@/lib/types";

export interface ExportMeta {
  cycleId: string;
  txHash: string;
}

const HEADER = ["cycleId", "from", "to", "amount", "currency", "status", "settlementRef"];

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** One row per settled leg, ready to hand to a TMS/GL import. */
export function toSettledLegsCsv(legs: SettlementLeg[], meta: ExportMeta): string {
  const rows = legs
    .filter((leg) => leg.status === "settled")
    .map((leg) =>
      [
        meta.cycleId,
        partyById(leg.from).shortName,
        partyById(leg.to).shortName,
        leg.amount.toFixed(2),
        "USDCx",
        leg.status,
        meta.txHash,
      ]
        .map(csvCell)
        .join(","),
    );
  return [HEADER.join(","), ...rows].join("\n");
}

/** Triggers a browser download of `csv` as `filename`, no deps. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
