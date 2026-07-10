import {
  ActivityEvent,
  NettingCycle,
  Obligation,
  Party,
  ScanSnapshot,
  TreasuryPolicy,
} from "@/lib/types";
import { mockHash } from "@/lib/format";

/* ------------------------------------------------------------------ */
/* Parties                                                            */
/* ------------------------------------------------------------------ */
export const PARTIES: Party[] = [
  {
    id: "company-a",
    name: "Aurora Manufacturing",
    shortName: "Company A",
    ledgerId: `aurora::1220${mockHash("aurora", 12)}`,
    color: "#8FB8D8",
    balance: 512_400.0,
  },
  {
    id: "company-b",
    name: "Borealis Logistics",
    shortName: "Company B",
    ledgerId: `borealis::1220${mockHash("borealis", 12)}`,
    color: "#D4B483",
    balance: 268_950.0,
  },
  {
    id: "company-c",
    name: "Cirrus Components",
    shortName: "Company C",
    ledgerId: `cirrus::1220${mockHash("cirrus", 12)}`,
    color: "#9DB8A8",
    balance: 194_310.0,
  },
];

/* ------------------------------------------------------------------ */
/* Obligations, a solvable netting graph                             */
/*                                                                    */
/*   gross flows        net positions (receivable - payable)          */
/*   A→B 120,000        A: -160,000 + 175,000 = +15,000 (receiver)    */
/*   B→C  95,000        B: -120,000 + 150,000 = +30,000 (receiver)    */
/*   C→A 150,000        C: -180,000 + 135,000 = -45,000 (payer)       */
/*   A→C  40,000                                                      */
/*   B→A  25,000        sum = 0 ✓  gross 460k → net 45k (90.2%        */
/*   C→B  30,000        compression)                                  */
/* ------------------------------------------------------------------ */
export const OBLIGATIONS: Obligation[] = [
  {
    id: "ob-001",
    contractId: `00${mockHash("ob-001")}`,
    obligor: "company-a",
    obligee: "company-b",
    amount: 120_000,
    currency: "USDCx",
    reference: "INV-2026-0341 · Freight Q2",
    dueDate: "2026-07-20",
    status: "open",
    source: "agent",
    createdAt: "2026-07-02T09:14:00Z",
  },
  {
    id: "ob-002",
    contractId: `00${mockHash("ob-002")}`,
    obligor: "company-b",
    obligee: "company-c",
    amount: 95_000,
    currency: "USDCx",
    reference: "INV-2026-1187 · Sensor modules",
    dueDate: "2026-07-18",
    status: "open",
    source: "agent",
    createdAt: "2026-07-03T11:02:00Z",
  },
  {
    id: "ob-003",
    contractId: `00${mockHash("ob-003")}`,
    obligor: "company-c",
    obligee: "company-a",
    amount: 150_000,
    currency: "USDCx",
    reference: "PO-88213 · Alloy stock",
    dueDate: "2026-07-22",
    status: "open",
    source: "manual",
    createdAt: "2026-07-03T15:47:00Z",
  },
  {
    id: "ob-004",
    contractId: `00${mockHash("ob-004")}`,
    obligor: "company-a",
    obligee: "company-c",
    amount: 40_000,
    currency: "USDCx",
    reference: "INV-2026-0398 · Tooling",
    dueDate: "2026-07-25",
    status: "open",
    source: "agent",
    createdAt: "2026-07-05T08:31:00Z",
  },
  {
    id: "ob-005",
    contractId: `00${mockHash("ob-005")}`,
    obligor: "company-b",
    obligee: "company-a",
    amount: 25_000,
    currency: "USDCx",
    reference: "CR-2026-077 · Damaged goods credit",
    dueDate: "2026-07-19",
    status: "open",
    source: "manual",
    createdAt: "2026-07-06T13:20:00Z",
  },
  {
    id: "ob-006",
    contractId: `00${mockHash("ob-006")}`,
    obligor: "company-c",
    obligee: "company-b",
    amount: 30_000,
    currency: "USDCx",
    reference: "INV-2026-1204 · Last-mile delivery",
    dueDate: "2026-07-21",
    status: "open",
    source: "agent",
    createdAt: "2026-07-07T10:05:00Z",
  },
];

/* ------------------------------------------------------------------ */
/* Netting cycle                                                      */
/* ------------------------------------------------------------------ */
export const OPEN_CYCLE: NettingCycle = {
  id: "cycle-2026-07-A",
  status: "open",
  obligationIds: OBLIGATIONS.map((o) => o.id),
  operator: `netting-op::1220${mockHash("operator", 12)}`,
  openedAt: "2026-07-08T00:00:00Z",
};

/* ------------------------------------------------------------------ */
/* Treasury policies (one per party)                                  */
/*                                                                    */
/* Company A's thresholds are deliberately low enough that the agent's */
/* 250,000 USDCx attempt on /app/policy trips maxSettlementPerCycle.  */
/* ------------------------------------------------------------------ */
export const POLICIES: TreasuryPolicy[] = [
  {
    party: "company-a",
    maxSettlementPerCycle: 200_000,
    allowedCounterparties: ["company-b", "company-c"],
    allowedInstrument: "USDCx",
    requiresHumanApprovalAbove: 50_000,
  },
  {
    party: "company-b",
    maxSettlementPerCycle: 500_000,
    allowedCounterparties: ["company-a", "company-c"],
    allowedInstrument: "USDCx",
    requiresHumanApprovalAbove: 150_000,
  },
  {
    party: "company-c",
    maxSettlementPerCycle: 350_000,
    allowedCounterparties: ["company-a", "company-b"],
    allowedInstrument: "USDCx",
    requiresHumanApprovalAbove: 100_000,
  },
];

/** The amount the rogue-agent demo attempts, above A's cycle cap. */
export const AGENT_OVERREACH_AMOUNT = 250_000;

/* ------------------------------------------------------------------ */
/* Canton network snapshot (Scan API shape, mocked)                   */
/* ------------------------------------------------------------------ */
export const SCAN_SNAPSHOT: ScanSnapshot = {
  validators: 417,
  superValidators: 13,
  governanceState: "CIP-56 vote open",
  ccPriceUsd: 0.0842,
  roundsPerDay: 8_640,
  totalAmuletBurnt: 14_382_912,
};

/* ------------------------------------------------------------------ */
/* Seed activity feed                                                 */
/* ------------------------------------------------------------------ */
export const SEED_ACTIVITY: ActivityEvent[] = [
  {
    id: "ev-001",
    at: "2026-07-08T00:00:00Z",
    actor: "operator",
    message: "Netting cycle cycle-2026-07-A opened, 6 obligations in scope",
    kind: "cycle",
  },
  {
    id: "ev-002",
    at: "2026-07-07T10:05:00Z",
    actor: "agent",
    message:
      "Extracted INV-2026-1204 and created Obligation 30,000.00 USDCx (C → B)",
    kind: "obligation",
  },
  {
    id: "ev-003",
    at: "2026-07-06T13:20:00Z",
    actor: "company-b",
    message: "Manual obligation CR-2026-077 recorded, 25,000.00 USDCx (B → A)",
    kind: "obligation",
  },
  {
    id: "ev-004",
    at: "2026-07-05T08:31:00Z",
    actor: "agent",
    message:
      "Extracted INV-2026-0398 and created Obligation 40,000.00 USDCx (A → C)",
    kind: "obligation",
  },
  {
    id: "ev-005",
    at: "2026-07-04T16:00:00Z",
    actor: "operator",
    message: "USDCx onboarding via xReserve confirmed for all three parties",
    kind: "network",
  },
];
