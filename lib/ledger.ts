/**
 * Client shim for the real Canton ledger. Mirrors the lib/api.ts signatures
 * exactly, so a page switches from mock → live by changing only its import
 * (and setting NEXT_PUBLIC_LEDGER_LIVE=1). The trailing `ledger`/`positions`
 * arguments are vestigial here, they are used only for the mock fallback.
 *
 * Every call degrades to the mock (lib/api.ts) when the flag is off, the route
 * returns 503 (ledger not configured), or the network fails, the demo never
 * hard-breaks. A real per-party projection miss (HTTP 404) is the one case we
 * do NOT swallow: it becomes the genuine PrivacyError.
 */

import * as api from "@/lib/api";
import { isSandbox } from "@/lib/sandbox";
import { ActivityEvent, NetPosition, Obligation, PartyId, PrivacyError, TreasuryPolicy } from "@/lib/types";

const LEDGER_LIVE = process.env.NEXT_PUBLIC_LEDGER_LIVE === "1";
/** Live only when the build flag is on AND this session is not a client-side
 *  sandbox tenant (a sandbox never touches the shared devnet ledger). */
const live = () => LEDGER_LIVE && !isSandbox();

/** Warning when a LIVE call falls back (network error or non-ok response). Logged
 *  in all environments, a silent fallback in production is the case with zero
 *  signal otherwise. */
function warnFallback(name: string, fellBackTo: "mock" | "null"): void {
  console.warn(`[ledger] live ${name} fell back to ${fellBackTo}`);
}

export type { PolicyVerdict, ExtractedInvoice } from "@/lib/api";
// Pure/mock-only helpers pass straight through, no ledger equivalent needed.
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
  if (!live()) return null;
  try {
    const r = await fetch(`/api/ledger/balance?party=${party}`);
    if (r.ok) return ((await r.json()) as { balance: number | null }).balance;
  } catch {
    /* fall through */
  }
  warnFallback("getBalanceLive", "null");
  return null;
}

/** All three on-ledger Account balances in one call (operator-scoped ACS). */
export async function getBalancesLive(): Promise<Partial<Record<PartyId, number>> | null> {
  if (!live()) return null;
  try {
    const r = await fetch("/api/ledger/balances");
    if (r.ok) return (await r.json()) as Partial<Record<PartyId, number>>;
  } catch {
    /* fall through */
  }
  warnFallback("getBalancesLive", "null");
  return null;
}

/* ---- activity feed + cycle status (live transaction history) ------------- */

/** Real on-chain activity feed from ledger transaction history, or null. */
export async function getActivityLive(): Promise<ActivityEvent[] | null> {
  if (!live()) return null;
  try {
    const r = await fetch("/api/ledger/activity");
    if (r.ok) return (await r.json()) as ActivityEvent[];
  } catch {
    /* fall through */
  }
  warnFallback("getActivityLive", "null");
  return null;
}

/** Live netting-cycle status (open/settled/none + short ref), or null. */
export async function getCycleStatusLive(): Promise<{
  status: "open" | "settled" | "none";
  ref: string | null;
} | null> {
  if (!live()) return null;
  try {
    const r = await fetch("/api/ledger/cycle-status");
    if (r.ok)
      return (await r.json()) as { status: "open" | "settled" | "none"; ref: string | null };
  } catch {
    /* fall through */
  }
  warnFallback("getCycleStatusLive", "null");
  return null;
}

/** Re-verify a settle updateId against the live validator (proves it is real,
 *  fetched on demand). Returns null when not live / on failure. */
export async function verifyUpdateLive(updateId: string): Promise<{
  confirmed: boolean;
  effectiveAt: string | null;
  validator: string;
} | null> {
  if (!live()) return null;
  try {
    const r = await fetch(`/api/ledger/verify?updateId=${encodeURIComponent(updateId)}`);
    if (r.ok)
      return (await r.json()) as { confirmed: boolean; effectiveAt: string | null; validator: string };
  } catch {
    /* fall through */
  }
  warnFallback("verifyUpdateLive", "null");
  return null;
}

/** All net positions from the most recent cycle (from history), or null. */
export async function getNetPositionsLive(): Promise<NetPosition[] | null> {
  if (!live()) return null;
  try {
    const r = await fetch("/api/ledger/net-positions");
    if (r.ok) return (await r.json()) as NetPosition[];
  } catch {
    /* fall through */
  }
  warnFallback("getNetPositionsLive", "null");
  return null;
}

/* ---- market data (T27, CoinGecko via /api/scan) -------------------------- */

export interface ScanLive {
  ccPriceUsd: number | null;
  ccMarketCapUsd: number | null;
  cc24hChange: number | null;
  usdcxPriceUsd: number | null;
}

/** Live Canton Coin market data via /api/scan (server-side cache + proxy). Not
 *  gated by the ledger flag: it is real market data regardless of live mode. */
export async function getScanLive(): Promise<ScanLive | null> {
  try {
    const r = await fetch("/api/scan");
    if (r.ok) return (await r.json()) as ScanLive;
  } catch {
    /* fall through */
  }
  warnFallback("getScanLive", "null");
  return null;
}

/* ---- reads (T13) --------------------------------------------------------- */

export async function getObligationsFor(
  party: PartyId,
  ledger: Obligation[],
): Promise<Obligation[]> {
  if (live()) {
    try {
      const r = await fetch(`/api/ledger/obligations?party=${party}`);
      if (r.ok) return (await r.json()) as Obligation[];
    } catch {
      /* fall through to mock */
    }
    warnFallback("getObligationsFor", "mock");
  }
  return api.getObligationsFor(party, ledger);
}

export async function queryContract(
  party: PartyId,
  contractId: string,
  ledger: Obligation[],
): Promise<Obligation> {
  if (live()) {
    try {
      const r = await fetch(
        `/api/ledger/contract?party=${party}&contractId=${encodeURIComponent(contractId)}`,
      );
      if (r.ok) return (await r.json()) as Obligation;
      // 404 = the node won't confirm the contract to this party, real privacy.
      if (r.status === 404) throw new PrivacyError(contractId, party);
    } catch (e) {
      if (e instanceof PrivacyError) throw e;
      /* network/other → mock */
    }
    warnFallback("queryContract", "mock");
  }
  return api.queryContract(party, contractId, ledger);
}

export async function getNetPositionFor(
  party: PartyId,
  positions: NetPosition[],
): Promise<NetPosition | null> {
  if (live()) {
    try {
      const r = await fetch(`/api/ledger/net-position?party=${party}`);
      if (r.ok) return (await r.json()) as NetPosition | null;
    } catch {
      /* fall through */
    }
    warnFallback("getNetPositionFor", "mock");
  }
  return api.getNetPositionFor(party, positions);
}

/* ---- policy (T14), real on-ledger CheckSettlement ----------------------- */

/** On-ledger TreasuryPolicy cap for `party`, or null when not live / unconfigured. */
export async function getPolicyLive(
  party: PartyId,
): Promise<{ maxSettlementPerCycle: number } | null> {
  if (!live()) return null;
  try {
    const r = await fetch(`/api/ledger/policy?party=${party}`);
    if (r.ok) return (await r.json()) as { maxSettlementPerCycle: number } | null;
  } catch {
    /* fall through */
  }
  warnFallback("getPolicyLive", "null");
  return null;
}

export async function checkPolicy(
  policy: TreasuryPolicy,
  amount: number,
  counterparty: PartyId,
): Promise<api.PolicyVerdict> {
  if (live()) {
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
    warnFallback("checkPolicy", "mock");
  }
  return api.checkPolicy(policy, amount, counterparty);
}

/* ---- writes (T14), return the real update id, or null when not live ----- */

/** Create an Obligation on-ledger. Returns the update id, or null if not live. */
export async function createObligationLive(input: {
  obligor: PartyId;
  obligee: PartyId;
  amount: number;
  reference: string;
  dueDate: string;
  source?: "agent" | "manual";
}): Promise<string | null> {
  if (!live()) return null;
  try {
    const r = await fetch("/api/ledger/obligation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!r.ok) {
      warnFallback("createObligationLive", "null");
      return null;
    }
    return ((await r.json()) as { updateId?: string }).updateId ?? null;
  } catch {
    warnFallback("createObligationLive", "null");
    return null;
  }
}

/** The obligee accepts a pending obligation (bilateral consent). Returns the
 *  update id, or null when not live / on failure. Only accepted obligations net. */
export async function acceptObligationLive(input: {
  obligee: PartyId;
  contractId: string;
}): Promise<string | null> {
  if (!live()) return null;
  try {
    const r = await fetch("/api/ledger/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!r.ok) {
      warnFallback("acceptObligationLive", "null");
      return null;
    }
    return ((await r.json()) as { updateId?: string }).updateId ?? null;
  } catch {
    warnFallback("acceptObligationLive", "null");
    return null;
  }
}

/** Create a NettingCycle + ComputeNetPositions on-ledger. Returns cycleId + positions. */
export async function runCycleLive(): Promise<{
  cycleId: string;
  netPositions: NetPosition[];
} | null> {
  if (!live()) return null;
  try {
    const r = await fetch("/api/ledger/run-cycle", { method: "POST" });
    if (r.ok) return (await r.json()) as { cycleId: string; netPositions: NetPosition[] };
  } catch {
    /* fall through to mock */
  }
  warnFallback("runCycleLive", "null");
  return null;
}

/** Run + Settle the current cycle on-ledger. Returns update id + net positions. */
export async function settleLive(): Promise<{
  updateId: string | null;
  netPositions: NetPosition[];
} | null> {
  if (!live()) return null;
  try {
    const r = await fetch("/api/ledger/settle", { method: "POST" });
    if (!r.ok) {
      warnFallback("settleLive", "null");
      return null;
    }
    const j = (await r.json()) as { updateId?: string; netPositions: NetPosition[] };
    return { updateId: j.updateId ?? null, netPositions: j.netPositions ?? [] };
  } catch {
    warnFallback("settleLive", "null");
    return null;
  }
}
