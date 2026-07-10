/**
 * Client shim for the real Canton ledger. Mirrors the lib/api.ts signatures
 * exactly, so a page switches from mock → live by changing only its import
 * (and setting NEXT_PUBLIC_LEDGER_LIVE=1). The trailing `ledger`/`positions`
 * arguments are vestigial here — they are used only for the mock fallback.
 *
 * Every call degrades to the mock (lib/api.ts) when the flag is off, the route
 * returns 503 (ledger not configured), or the network fails — the demo never
 * hard-breaks. A real per-party projection miss (HTTP 404) is the one case we
 * do NOT swallow: it becomes the genuine PrivacyError.
 */

import * as api from "@/lib/api";
import { NetPosition, Obligation, PartyId, PrivacyError, TreasuryPolicy } from "@/lib/types";

const LIVE = process.env.NEXT_PUBLIC_LEDGER_LIVE === "1";

export type { PolicyVerdict, ExtractedInvoice } from "@/lib/api";
// Pure/mock-only helpers pass straight through — no ledger equivalent needed.
export {
  computeNetPositions,
  buildSettlementLegs,
  getParties,
  getScanSnapshot,
  extractInvoice,
  newTxHash,
} from "@/lib/api";

/* ---- balance (live Account read) ---------------------------------------- */

/** On-ledger Account balance for `party`, or null when not live / unconfigured. */
export async function getBalanceLive(party: PartyId): Promise<number | null> {
  if (!LIVE) return null;
  try {
    const r = await fetch(`/api/ledger/balance?party=${party}`);
    if (r.ok) return ((await r.json()) as { balance: number | null }).balance;
  } catch {
    /* fall through */
  }
  return null;
}

/* ---- reads (T13) --------------------------------------------------------- */

export async function getObligationsFor(
  party: PartyId,
  ledger: Obligation[],
): Promise<Obligation[]> {
  if (LIVE) {
    try {
      const r = await fetch(`/api/ledger/obligations?party=${party}`);
      if (r.ok) return (await r.json()) as Obligation[];
    } catch {
      /* fall through to mock */
    }
  }
  return api.getObligationsFor(party, ledger);
}

export async function queryContract(
  party: PartyId,
  contractId: string,
  ledger: Obligation[],
): Promise<Obligation> {
  if (LIVE) {
    try {
      const r = await fetch(
        `/api/ledger/contract?party=${party}&contractId=${encodeURIComponent(contractId)}`,
      );
      if (r.ok) return (await r.json()) as Obligation;
      // 404 = the node won't confirm the contract to this party — real privacy.
      if (r.status === 404) throw new PrivacyError(contractId, party);
    } catch (e) {
      if (e instanceof PrivacyError) throw e;
      /* network/other → mock */
    }
  }
  return api.queryContract(party, contractId, ledger);
}

export async function getNetPositionFor(
  party: PartyId,
  positions: NetPosition[],
): Promise<NetPosition | null> {
  if (LIVE) {
    try {
      const r = await fetch(`/api/ledger/net-position?party=${party}`);
      if (r.ok) return (await r.json()) as NetPosition | null;
    } catch {
      /* fall through */
    }
  }
  return api.getNetPositionFor(party, positions);
}

/* ---- policy (T14) — real on-ledger CheckSettlement ----------------------- */

export async function checkPolicy(
  policy: TreasuryPolicy,
  amount: number,
  counterparty: PartyId,
): Promise<api.PolicyVerdict> {
  if (LIVE) {
    try {
      const r = await fetch("/api/ledger/policy-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ party: policy.party, amount }),
      });
      if (r.ok) {
        const v = (await r.json()) as { ok: boolean; ruleFired?: string };
        return v.ok
          ? { verdict: "approved" }
          : { verdict: "rejected", ruleFired: v.ruleFired };
      }
    } catch {
      /* fall through to mock */
    }
  }
  return api.checkPolicy(policy, amount, counterparty);
}

/* ---- writes (T14) — return the real update id, or null when not live ----- */

/** Create an Obligation on-ledger. Returns the update id, or null if not live. */
export async function createObligationLive(input: {
  obligor: PartyId;
  obligee: PartyId;
  amount: number;
  reference: string;
  dueDate: string;
}): Promise<string | null> {
  if (!LIVE) return null;
  try {
    const r = await fetch("/api/ledger/obligation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!r.ok) return null;
    return ((await r.json()) as { updateId?: string }).updateId ?? null;
  } catch {
    return null;
  }
}

/** Create a NettingCycle + ComputeNetPositions on-ledger. Returns cycleId + positions. */
export async function runCycleLive(): Promise<{
  cycleId: string;
  netPositions: NetPosition[];
} | null> {
  if (!LIVE) return null;
  try {
    const r = await fetch("/api/ledger/run-cycle", { method: "POST" });
    if (r.ok) return (await r.json()) as { cycleId: string; netPositions: NetPosition[] };
  } catch {
    /* fall through to mock */
  }
  return null;
}

/** Run + Settle the current cycle on-ledger. Returns update id + net positions. */
export async function settleLive(): Promise<{
  updateId: string | null;
  netPositions: NetPosition[];
} | null> {
  if (!LIVE) return null;
  try {
    const r = await fetch("/api/ledger/settle", { method: "POST" });
    if (!r.ok) return null;
    const j = (await r.json()) as { updateId?: string; netPositions: NetPosition[] };
    return { updateId: j.updateId ?? null, netPositions: j.netPositions ?? [] };
  } catch {
    return null;
  }
}
