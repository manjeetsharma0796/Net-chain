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
import { OBLIGATIONS } from "@/lib/mock/data";
import { isSandbox } from "@/lib/sandbox";
import { ActivityEvent, NetPosition, Obligation, PartyId, PrivacyError, SettlementLeg, TreasuryPolicy } from "@/lib/types";

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

/** Shared body for the live-only GET wrappers: null when not live, parsed JSON
 *  when the `/api/ledger/<path>` route answers ok, else a logged null fallback. */
async function liveGet<T>(path: string, name: string): Promise<T | null> {
  if (!live()) return null;
  try {
    const r = await fetch(`/api/ledger/${path}`);
    if (r.ok) return (await r.json()) as T;
  } catch {
    /* fall through */
  }
  warnFallback(name, "null");
  return null;
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

/** Real on-chain activity feed from ledger transaction history, or null. `limit`
 *  (optional) pulls fuller history, e.g. the audit page's tracked tx log. */
export async function getActivityLive(limit?: number): Promise<ActivityEvent[] | null> {
  return liveGet<ActivityEvent[]>(limit ? `activity?limit=${limit}` : "activity", "getActivityLive");
}

/** Live netting-cycle status (open/settled/none + short ref), or null. */
export async function getCycleStatusLive(): Promise<{
  status: "open" | "settled" | "none";
  ref: string | null;
} | null> {
  return liveGet<{ status: "open" | "settled" | "none"; ref: string | null }>(
    "cycle-status",
    "getCycleStatusLive",
  );
}

/** Re-verify a settle updateId against the live validator (proves it is real,
 *  fetched on demand). Returns null when not live / on failure. */
export async function verifyUpdateLive(updateId: string): Promise<{
  confirmed: boolean;
  effectiveAt: string | null;
  validator: string;
} | null> {
  return liveGet<{ confirmed: boolean; effectiveAt: string | null; validator: string }>(
    `verify?updateId=${encodeURIComponent(updateId)}`,
    "verifyUpdateLive",
  );
}

/** All net positions from the most recent cycle (from history), or null. */
export async function getNetPositionsLive(): Promise<NetPosition[] | null> {
  return liveGet<NetPosition[]>("net-positions", "getNetPositionsLive");
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
      /* fall through */
    }
    // Live: NEVER fall back to the mock ledger, that was the phantom-obligation
    // source. A failed read yields an empty projection, not fabricated rows.
    warnFallback("getObligationsFor", "null");
    return [];
  }
  // Mock mode only (LEDGER_LIVE off): the store no longer seeds obligations, so
  // use the demo set when the caller's (store) ledger is empty.
  return api.getObligationsFor(party, ledger.length ? ledger : OBLIGATIONS);
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

/* ---- maker-checker cap governance (T65), live-only ---------------------- */

/** All pending cap-change proposals, or null when not live. */
export async function getCapProposalsLive(): Promise<
  { proposalCid: string; party: PartyId; newCap: number }[] | null
> {
  return liveGet<{ proposalCid: string; party: PartyId; newCap: number }[]>(
    "cap-proposals",
    "getCapProposalsLive",
  );
}

/** Maker: the party proposes a new cap. Returns the update id, or null. */
export async function proposeCapLive(input: {
  party: PartyId;
  newCap: number;
}): Promise<string | null> {
  return postCap("propose-cap", input);
}

/** Checker: the operator approves a pending proposal. Returns the update id, or null. */
export async function approveCapLive(proposalCid: string): Promise<string | null> {
  return postCap("approve-cap", { proposalCid });
}

/** Checker: the operator rejects a pending proposal. Returns the update id, or null. */
export async function rejectCapLive(proposalCid: string): Promise<string | null> {
  return postCap("reject-cap", { proposalCid });
}

async function postCap(op: string, body: unknown): Promise<string | null> {
  if (!live()) return null;
  try {
    const r = await fetch(`/api/ledger/${op}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.ok) return ((await r.json()) as { updateId?: string }).updateId ?? null;
  } catch {
    /* fall through */
  }
  warnFallback(op, "null");
  return null;
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
  obligor: PartyId;
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

/** Create a NettingCycle + ComputeNetPositions on-ledger over the operator's
 *  selected obligations (WR4). Returns cycleId + positions. */
export async function runCycleLive(obligationCids?: string[]): Promise<{
  cycleId: string;
  netPositions: NetPosition[];
} | null> {
  if (!live()) return null;
  try {
    const r = await fetch("/api/ledger/run-cycle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ obligationCids }),
    });
    if (r.ok) return (await r.json()) as { cycleId: string; netPositions: NetPosition[] };
  } catch {
    /* fall through to mock */
  }
  warnFallback("runCycleLive", "null");
  return null;
}

/** Run + Settle the current cycle on-ledger. Returns update id + net positions. */
/** A real on-ledger rejection (e.g. a TreasuryPolicy cap breach), as opposed to
 *  a not-live/network fallback. The UI must surface this, never show success. */
export class LedgerRejection extends Error {}

export async function settleLive(obligationCids?: string[]): Promise<{
  updateId: string | null;
  netPositions: NetPosition[];
  legs: SettlementLeg[];
} | null> {
  if (!live()) return null;
  try {
    const r = await fetch("/api/ledger/settle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ obligationCids }),
    });
    if (r.ok) {
      const j = (await r.json()) as {
        updateId?: string;
        netPositions: NetPosition[];
        legs?: SettlementLeg[];
      };
      return { updateId: j.updateId ?? null, netPositions: j.netPositions ?? [], legs: j.legs ?? [] };
    }
    // 503 = ledger not configured -> genuine mock fallback. Any other non-ok
    // (502 = the Daml Settle rejected it, e.g. a policy-cap breach) is a REAL
    // failure the UI must show, not silently swallow into a mock "success".
    if (r.status === 503) {
      warnFallback("settleLive", "null");
      return null;
    }
    const body = (await r.json().catch(() => null)) as { error?: string } | null;
    throw new LedgerRejection(body?.error || `settle failed (HTTP ${r.status})`);
  } catch (e) {
    if (e instanceof LedgerRejection) throw e; // real rejection, propagate
    warnFallback("settleLive", "null"); // network error -> mock fallback
    return null;
  }
}

/* ---- live party identities (WR8) ---------------------------------------- */

export interface LivePartyIdentity {
  id: PartyId | "operator";
  ledgerId: string;
  baseName: string;
}

/** Real on-ledger party identities (id + base name) in live mode, or null. Lets
 *  the frontend relabel the company-a/b/c slots with the ACTUAL parties this
 *  deployment points at, instead of the hardcoded mock names. */
export async function getPartiesLive(): Promise<LivePartyIdentity[] | null> {
  return liveGet<LivePartyIdentity[]>("parties", "getPartiesLive");
}

/* ---- privacy check ground truth (WR6) ----------------------------------- */

/** Every Obligation on-ledger with its REAL contract id (operator is observer
 *  on all of them), the ground-truth set the privacy page renders and joins the
 *  per-party projection against. Live: null on failure. Mock: the demo set, so
 *  the contractId join still matches the mock per-party projection. */
export async function getAllObligationsLive(): Promise<Obligation[] | null> {
  if (live()) return liveGet<Obligation[]>("obligations-all", "getAllObligationsLive");
  return OBLIGATIONS;
}
