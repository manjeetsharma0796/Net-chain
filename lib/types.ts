/**
 * NetChain domain types. These mirror the Daml contract shapes the real
 * integration would expose via the Ledger JSON API, so `lib/api.ts` can
 * be swapped for real ledger reads without touching the UI.
 */

export type PartyId = "company-a" | "company-b" | "company-c";

export interface Party {
  id: PartyId;
  /** Display name, e.g. "Aurora Manufacturing". */
  name: string;
  /** Short label used in tight UI: "Company A". */
  shortName: string;
  /** Canton-style party identifier (fingerprint). */
  ledgerId: string;
  /** Accent used for avatars / graph nodes. */
  color: string;
  /** USDCx wallet balance (mock). */
  balance: number;
}

export type ObligationStatus = "open" | "netted" | "settled" | "rejected";

export interface Obligation {
  id: string;
  /** Contract ID on the ledger (mock hash). */
  contractId: string;
  /** Party that owes. */
  obligor: PartyId;
  /** Party that is owed. */
  obligee: PartyId;
  amount: number;
  currency: "USDCx";
  /** Invoice / PO reference. */
  reference: string;
  dueDate: string;
  status: ObligationStatus;
  /** How the obligation entered the ledger. */
  source: "agent" | "manual";
  createdAt: string;
}

export type CycleStatus =
  | "open"
  | "computing"
  | "computed"
  | "settling"
  | "settled"
  | "failed";

export interface NettingCycle {
  id: string;
  status: CycleStatus;
  /** Obligation ids in scope for this cycle. */
  obligationIds: string[];
  operator: string;
  openedAt: string;
}

export interface NetPosition {
  party: PartyId;
  /** Positive = net receiver, negative = net payer. Sums to zero. */
  net: number;
  grossPayable: number;
  grossReceivable: number;
  cycleId: string;
}

export interface TreasuryPolicy {
  party: PartyId;
  maxSettlementPerCycle: number;
  allowedCounterparties: PartyId[];
  allowedInstrument: "USDCx";
  requiresHumanApprovalAbove: number;
}

export type LegStatus = "awaiting-allocation" | "allocated" | "settled" | "reverted";

export interface SettlementLeg {
  id: string;
  from: PartyId;
  to: PartyId;
  amount: number;
  status: LegStatus;
}

/** Snapshot of Canton network stats (mirrors the Scan API shape). */
export interface ScanSnapshot {
  validators: number;
  superValidators: number;
  governanceState: string;
  ccPriceUsd: number;
  roundsPerDay: number;
  totalAmuletBurnt: number;
}

export interface ActivityEvent {
  id: string;
  at: string;
  actor: "agent" | PartyId | "operator";
  message: string;
  kind: "obligation" | "cycle" | "settlement" | "policy" | "network";
}

export interface PolicyEvent {
  id: string;
  at: string;
  attemptedAmount: number;
  verdict: "approved" | "rejected";
  /** The policy rule that fired, when rejected. */
  ruleFired?: string;
}

/** Thrown by the mock ledger when a party queries a contract it is not a party to. */
export class PrivacyError extends Error {
  constructor(
    public readonly contractId: string,
    public readonly requestingParty: PartyId,
  ) {
    super(
      `CONTRACT_NOT_FOUND: party ${requestingParty} is not a stakeholder on ${contractId}`,
    );
    this.name = "PrivacyError";
  }
}
