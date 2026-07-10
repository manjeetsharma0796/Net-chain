/**
 * Mock ledger API.
 *
 * Every read is PARTY-SCOPED: functions take the requesting party and
 * filter server-side (here: shim-side), so privacy is enforced in the
 * data layer, not the UI. Swapping this file for real Canton Ledger
 * API / Scan API calls is the intended integration path, the function
 * signatures are the contract.
 */

import {
  NetPosition,
  Obligation,
  Party,
  PartyId,
  PrivacyError,
  ScanSnapshot,
  SettlementLeg,
  TreasuryPolicy,
} from "@/lib/types";
import { PARTIES, SCAN_SNAPSHOT } from "@/lib/mock/data";
import { mockHash } from "@/lib/format";

/** Simulated network latency so loading states are demoable. */
const delay = (ms = 350) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function getParties(): Promise<Party[]> {
  await delay(200);
  return PARTIES;
}

export async function getScanSnapshot(): Promise<ScanSnapshot> {
  await delay(500);
  return SCAN_SNAPSHOT;
}

/**
 * A party sees an obligation iff it is a stakeholder (obligor or
 * obligee). This mirrors Canton's per-party ledger projection.
 */
export async function getObligationsFor(
  party: PartyId,
  ledger: Obligation[],
): Promise<Obligation[]> {
  await delay(400);
  return ledger.filter((o) => o.obligor === party || o.obligee === party);
}

/**
 * Direct contract lookup. Non-stakeholders get CONTRACT_NOT_FOUND -
 * the ledger does not even acknowledge the contract exists.
 */
export async function queryContract(
  party: PartyId,
  contractId: string,
  ledger: Obligation[],
): Promise<Obligation> {
  await delay(600);
  const contract = ledger.find((o) => o.contractId === contractId);
  if (!contract || (contract.obligor !== party && contract.obligee !== party)) {
    throw new PrivacyError(contractId, party);
  }
  return contract;
}

/**
 * Multilateral netting: each party's net = receivables − payables over
 * the in-scope set. The nets sum to zero by construction.
 */
export function computeNetPositions(
  obligations: Obligation[],
  cycleId: string,
): NetPosition[] {
  const map = new Map<PartyId, NetPosition>();
  const ensure = (p: PartyId) => {
    if (!map.has(p)) {
      map.set(p, {
        party: p,
        net: 0,
        grossPayable: 0,
        grossReceivable: 0,
        cycleId,
      });
    }
    return map.get(p)!;
  };
  for (const o of obligations) {
    const payer = ensure(o.obligor);
    payer.grossPayable += o.amount;
    payer.net -= o.amount;
    const receiver = ensure(o.obligee);
    receiver.grossReceivable += o.amount;
    receiver.net += o.amount;
  }
  return [...map.values()].sort((a, b) => a.party.localeCompare(b.party));
}

/** Party-scoped view of a computed cycle: only your own figure. */
export async function getNetPositionFor(
  party: PartyId,
  positions: NetPosition[],
): Promise<NetPosition | null> {
  await delay(300);
  return positions.find((p) => p.party === party) ?? null;
}

/**
 * Greedy matching of net payers to net receivers → the minimal set of
 * settlement legs that clears every position.
 */
export function buildSettlementLegs(
  positions: NetPosition[],
): SettlementLeg[] {
  const payers = positions
    .filter((p) => p.net < 0)
    .map((p) => ({ party: p.party, remaining: -p.net }));
  const receivers = positions
    .filter((p) => p.net > 0)
    .map((p) => ({ party: p.party, remaining: p.net }));

  const legs: SettlementLeg[] = [];
  let i = 0;
  let j = 0;
  while (i < payers.length && j < receivers.length) {
    const amount = Math.min(payers[i].remaining, receivers[j].remaining);
    legs.push({
      id: `leg-${legs.length + 1}`,
      from: payers[i].party,
      to: receivers[j].party,
      amount,
      status: "awaiting-allocation",
    });
    payers[i].remaining -= amount;
    receivers[j].remaining -= amount;
    if (payers[i].remaining === 0) i++;
    if (receivers[j].remaining === 0) j++;
  }
  return legs;
}

export interface PolicyVerdict {
  verdict: "approved" | "rejected";
  ruleFired?: string;
}

/**
 * On-ledger policy check. In the real system this is a Daml assertion
 * inside the settlement choice, the agent cannot route around it.
 */
export async function checkPolicy(
  policy: TreasuryPolicy,
  amount: number,
  counterparty: PartyId,
): Promise<PolicyVerdict> {
  await delay(700);
  if (amount > policy.maxSettlementPerCycle) {
    return {
      verdict: "rejected",
      ruleFired: `maxSettlementPerCycle: ${amount.toLocaleString()} > ${policy.maxSettlementPerCycle.toLocaleString()} USDCx`,
    };
  }
  if (!policy.allowedCounterparties.includes(counterparty)) {
    return {
      verdict: "rejected",
      ruleFired: `allowedCounterparties: ${counterparty} not in policy`,
    };
  }
  if (amount > policy.requiresHumanApprovalAbove) {
    return {
      verdict: "rejected",
      ruleFired: `requiresHumanApprovalAbove: ${amount.toLocaleString()} > ${policy.requiresHumanApprovalAbove.toLocaleString()} USDCx, human approval missing`,
    };
  }
  return { verdict: "approved" };
}

/* ------------------------------------------------------------------ */
/* Mock invoice extraction (the "AI front door", faked)               */
/* ------------------------------------------------------------------ */

export interface ExtractedInvoice {
  counterparty: PartyId;
  amount: number;
  reference: string;
  dueDate: string;
  confidence: number;
}

const EXTRACTION_POOL: Omit<ExtractedInvoice, "counterparty">[] = [
  {
    amount: 18_500,
    reference: "INV-2026-0412 · Packaging services",
    dueDate: "2026-08-01",
    confidence: 0.97,
  },
  {
    amount: 62_300,
    reference: "INV-2026-0455 · Assembly line retrofit",
    dueDate: "2026-08-06",
    confidence: 0.94,
  },
  {
    amount: 7_840,
    reference: "INV-2026-0470 · Calibration audit",
    dueDate: "2026-07-29",
    confidence: 0.99,
  },
];

let extractionCounter = 0;

/**
 * Pretends to OCR the dropped file (the file itself is never read).
 * Returns a plausible extraction addressed to a counterparty of the
 * current party. ~1.8s latency so the scanning animation reads on stage.
 */
export async function extractInvoice(
  currentParty: PartyId,
): Promise<ExtractedInvoice> {
  await delay(1800);
  const counterparties = PARTIES.filter((p) => p.id !== currentParty);
  const pick = EXTRACTION_POOL[extractionCounter % EXTRACTION_POOL.length];
  const counterparty =
    counterparties[extractionCounter % counterparties.length].id;
  extractionCounter++;
  return { ...pick, counterparty };
}

/** Stable-looking mock transaction hash for a settlement commit. */
export function newTxHash(seed: string): string {
  return `0x${mockHash(`tx-${seed}`, 64)}`;
}
