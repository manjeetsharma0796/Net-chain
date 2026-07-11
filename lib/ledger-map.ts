/**
 * Pure adapters between the JSON Ledger API payloads and NetChain's frontend
 * types. No secrets, no process.env, no fetch, safe to import anywhere. The
 * server module (lib/ledger-server.ts) supplies the party-id lookups; this file
 * only shapes data.
 *
 * Field gaps (the ledger carries less than the UI): on-ledger `Obligation` has
 * no source/createdAt/currency, `NetPosition` has no gross figures. We fill
 * sensible defaults, the operator view still computes gross locally via
 * lib/api.ts, and gross is not shown in the party-scoped views.
 */

import { NetPosition, Obligation, PartyId } from "@/lib/types";

export interface AccountBalance {
  party: PartyId;
  balance: number;
}

/** Frontend party order, index 0..2 == company-a/b/c. */
export const PARTY_IDS: PartyId[] = ["company-a", "company-b", "company-c"];

/** A created contract as returned in an ACS entry. */
export interface LedgerContract {
  contractId: string;
  payload: Record<string, unknown>;
}

/** Ledger `Obligation` createArgument → frontend Obligation. */
export function toObligation(
  c: LedgerContract,
  toPartyId: (ledgerId: string) => PartyId | null,
): Obligation | null {
  const p = c.payload;
  const obligor = toPartyId(String(p.obligor ?? ""));
  const obligee = toPartyId(String(p.obligee ?? ""));
  if (!obligor || !obligee) return null; // a party outside the demo cast
  return {
    id: c.contractId,
    contractId: c.contractId,
    obligor,
    obligee,
    amount: Number(p.amount ?? 0),
    currency: "USDCx",
    reference: String(p.reference ?? ""),
    dueDate: String(p.dueDate ?? ""),
    status: p.settled === true ? "settled" : "open",
    // On-ledger provenance (v1.0.2+); older contracts have no source -> manual.
    source: p.source === "agent" ? "agent" : "manual",
    createdAt: "",
    uetr: p.uetr ? String(p.uetr) : undefined,
  };
}

/** Ledger `Account` createArgument → { party, balance }. */
export function toAccount(
  c: LedgerContract,
  toPartyId: (ledgerId: string) => PartyId | null,
): AccountBalance | null {
  const p = c.payload;
  const party = toPartyId(String(p.owner ?? ""));
  if (!party) return null;
  return { party, balance: Number(p.balance ?? 0) };
}

/** Ledger `NetPosition` createArgument → frontend NetPosition (gross unknown → 0). */
export function toNetPosition(
  c: LedgerContract,
  toPartyId: (ledgerId: string) => PartyId | null,
): NetPosition | null {
  const p = c.payload;
  const party = toPartyId(String(p.party ?? ""));
  if (!party) return null;
  return {
    party,
    net: Number(p.net ?? 0),
    grossPayable: 0,
    grossReceivable: 0,
    cycleId: String(p.cycleId ?? ""),
  };
}
