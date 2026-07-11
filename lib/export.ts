/**
 * Settled-legs export for an existing TMS/GL: a generic CSV, plus an ISO 20022
 * pain.001.001.09 (customer credit transfer initiation) document. Post the
 * Nov-2025 MT/MX cutover, cross-border instructions must be ISO 20022 MX, so the
 * XML is the format a bank/TMS actually ingests; the CSV stays for spreadsheets.
 */

import { partyById } from "@/lib/store";
import { PartyId, SettlementLeg } from "@/lib/types";

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

function xmlEscape(s: string): string {
  return s.replace(
    /[<>&'"]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] as string,
  );
}

// Generic Othr identification (party id / operator), not a real IBAN/BIC.
const acctId = (id: string) => `<Id><Othr><Id>${xmlEscape(id)}</Id></Othr></Id>`;
const AGENT = "<FinInstnId><Othr><Id>NETCHAIN</Id></Othr></FinInstnId>";

/**
 * Settled legs as an ISO 20022 pain.001.001.09 document, one `PmtInf` per debtor
 * (net payer). Honest placeholders: amounts are carried in ISO 4217 "USD" (the
 * USDCx unit of account, 1:1 USD) because "USDCx" is not an ISO currency, and
 * accounts/agents use generic `Othr` identifiers, not real IBAN/BIC.
 */
export function toIso20022Xml(legs: SettlementLeg[], meta: ExportMeta): string {
  const settled = legs.filter((l) => l.status === "settled");
  const now = new Date();
  const creDtTm = now.toISOString().replace(/\.\d+Z$/, "Z");
  const reqDt = creDtTm.slice(0, 10);
  const ctrlSum = settled.reduce((s, l) => s + l.amount, 0).toFixed(2);
  const msgId = `NETCHAIN-${meta.cycleId}-${now.getTime()}`;

  const byDebtor = new Map<PartyId, SettlementLeg[]>();
  for (const l of settled) {
    const arr = byDebtor.get(l.from) ?? [];
    arr.push(l);
    byDebtor.set(l.from, arr);
  }

  const pmtInfs = [...byDebtor.entries()]
    .map(([from, group], i) => {
      const dbtrName = xmlEscape(partyById(from).name);
      const sum = group.reduce((s, l) => s + l.amount, 0).toFixed(2);
      const txs = group
        .map((l) => {
          const e2e = xmlEscape(`${meta.cycleId}-${l.id}`);
          return `        <CdtTrfTxInf>
          <PmtId><EndToEndId>${e2e}</EndToEndId></PmtId>
          <Amt><InstdAmt Ccy="USD">${l.amount.toFixed(2)}</InstdAmt></Amt>
          <CdtrAgt>${AGENT}</CdtrAgt>
          <Cdtr><Nm>${xmlEscape(partyById(l.to).name)}</Nm></Cdtr>
          <CdtrAcct>${acctId(l.to)}</CdtrAcct>
          <RmtInf><Ustrd>NetChain cycle ${xmlEscape(meta.cycleId)} settled net leg</Ustrd></RmtInf>
        </CdtTrfTxInf>`;
        })
        .join("\n");
      return `      <PmtInf>
        <PmtInfId>${xmlEscape(meta.cycleId)}-${i + 1}</PmtInfId>
        <PmtMtd>TRF</PmtMtd>
        <NbOfTxs>${group.length}</NbOfTxs>
        <CtrlSum>${sum}</CtrlSum>
        <ReqdExctnDt><Dt>${reqDt}</Dt></ReqdExctnDt>
        <Dbtr><Nm>${dbtrName}</Nm></Dbtr>
        <DbtrAcct>${acctId(from)}</DbtrAcct>
        <DbtrAgt>${AGENT}</DbtrAgt>
${txs}
      </PmtInf>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.09">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>${xmlEscape(msgId)}</MsgId>
      <CreDtTm>${creDtTm}</CreDtTm>
      <NbOfTxs>${settled.length}</NbOfTxs>
      <CtrlSum>${ctrlSum}</CtrlSum>
      <InitgPty><Nm>NetChain Netting Operator</Nm></InitgPty>
    </GrpHdr>
${pmtInfs}
  </CstmrCdtTrfInitn>
</Document>`;
}

function triggerDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Triggers a browser download of `csv` as `filename`, no deps. */
export function downloadCsv(filename: string, csv: string): void {
  triggerDownload(filename, new Blob([csv], { type: "text/csv;charset=utf-8;" }));
}

/** Triggers a browser download of `xml` as `filename`, no deps. */
export function downloadXml(filename: string, xml: string): void {
  triggerDownload(filename, new Blob([xml], { type: "application/xml;charset=utf-8;" }));
}
