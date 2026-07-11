"use client";

/**
 * Client-side session state. The store holds the mutable demo ledger
 * (obligations created during the session, cycle progress, settlement
 * state) plus UI concerns (current party, toasts). All *reads* still go
 * through lib/api.ts so party-scoping stays in the data layer.
 */

import { create } from "zustand";
import {
  ActivityEvent,
  CycleStatus,
  NetPosition,
  Obligation,
  PartyId,
  PolicyEvent,
  SettlementLeg,
} from "@/lib/types";
import {
  OBLIGATIONS,
  OPEN_CYCLE,
  PARTIES,
  SEED_ACTIVITY,
} from "@/lib/mock/data";
import { mockHash } from "@/lib/format";
import { setSandbox } from "@/lib/sandbox";

const shortLabel = (s: string) => (s.trim().length <= 16 ? s.trim() : s.trim().slice(0, 14) + "…");

export interface ToastItem {
  id: number;
  kind: "success" | "error" | "info";
  message: string;
}

interface NetChainState {
  /* identity */
  currentPartyId: PartyId;
  setParty: (id: PartyId) => void;

  /* sandbox tenant (self-serve "try it yourself", client-side only) */
  sandboxMode: boolean;
  partyLabels: Record<PartyId, { name: string; shortName: string }> | null;
  initSandbox: (input: { companyName: string; counterparties: [string, string] }) => void;
  exitSandbox: () => void;

  /* balances (party id → USDCx), mutated by settlement */
  balances: Record<PartyId, number>;
  setBalances: (b: Partial<Record<PartyId, number>>) => void;

  /* ledger */
  obligations: Obligation[];
  addObligation: (
    o: Omit<Obligation, "id" | "contractId" | "createdAt" | "status">,
  ) => Obligation;
  markObligations: (ids: string[], status: Obligation["status"]) => void;

  /* netting cycle */
  cycleId: string;
  cycleStatus: CycleStatus;
  setCycleStatus: (s: CycleStatus) => void;
  netPositions: NetPosition[] | null;
  setNetPositions: (p: NetPosition[] | null) => void;

  /* settlement */
  legs: SettlementLeg[];
  setLegs: (legs: SettlementLeg[]) => void;
  setLegStatus: (
    ids: string[] | "all",
    status: SettlementLeg["status"],
  ) => void;
  txHash: string | null;
  setTxHash: (h: string | null) => void;
  applySettlementBalances: () => void;

  /* policy */
  policyEvents: PolicyEvent[];
  addPolicyEvent: (e: Omit<PolicyEvent, "id" | "at">) => void;

  /* activity + toasts */
  activity: ActivityEvent[];
  logActivity: (
    e: Omit<ActivityEvent, "id" | "at">,
  ) => void;
  toasts: ToastItem[];
  pushToast: (kind: ToastItem["kind"], message: string) => void;
  dismissToast: (id: number) => void;
}

let seq = 100;

export const useNetChain = create<NetChainState>((set, get) => ({
  currentPartyId: "company-a",
  setParty: (id) => set({ currentPartyId: id }),

  sandboxMode: false,
  partyLabels: null,
  initSandbox: ({ companyName, counterparties }) => {
    setSandbox(true); // lib/ledger.ts now skips the live ledger for this session
    const labels = {
      "company-a": { name: companyName, shortName: shortLabel(companyName) },
      "company-b": { name: counterparties[0], shortName: shortLabel(counterparties[0]) },
      "company-c": { name: counterparties[1], shortName: shortLabel(counterparties[1]) },
    } as Record<PartyId, { name: string; shortName: string }>;
    const now = new Date().toISOString();
    const obl = (
      obligor: PartyId,
      obligee: PartyId,
      amount: number,
      reference: string,
      i: number,
    ): Obligation => ({
      id: `sbx-${i}`,
      contractId: `00${mockHash("sbx-" + i)}`,
      obligor,
      obligee,
      amount,
      currency: "USDCx",
      reference,
      dueDate: "2026-07-20",
      status: "open",
      source: "manual",
      createdAt: now,
    });
    set({
      sandboxMode: true,
      partyLabels: labels,
      currentPartyId: "company-a",
      balances: { "company-a": 100000, "company-b": 100000, "company-c": 100000 },
      // A small starter cycle so netting is meaningful immediately (150k gross).
      obligations: [
        obl("company-a", "company-b", 50000, "INV-1001", 1),
        obl("company-b", "company-c", 30000, "INV-1002", 2),
        obl("company-c", "company-a", 40000, "INV-1003", 3),
      ],
      cycleId: "sandbox-cycle",
      cycleStatus: "open",
      netPositions: null,
      legs: [],
      txHash: null,
      policyEvents: [],
      activity: [],
    });
  },
  exitSandbox: () => {
    setSandbox(false);
    set({
      sandboxMode: false,
      partyLabels: null,
      currentPartyId: "company-a",
      balances: Object.fromEntries(PARTIES.map((p) => [p.id, p.balance])) as Record<PartyId, number>,
      obligations: OBLIGATIONS,
      cycleId: OPEN_CYCLE.id,
      cycleStatus: OPEN_CYCLE.status,
      netPositions: null,
      legs: [],
      txHash: null,
      policyEvents: [],
      activity: SEED_ACTIVITY,
    });
  },

  balances: Object.fromEntries(
    PARTIES.map((p) => [p.id, p.balance]),
  ) as Record<PartyId, number>,
  setBalances: (b) => set((s) => ({ balances: { ...s.balances, ...b } })),

  obligations: OBLIGATIONS,
  addObligation: (draft) => {
    const id = `ob-${++seq}`;
    const created: Obligation = {
      ...draft,
      id,
      contractId: `00${mockHash(id)}`,
      status: "open",
      createdAt: new Date().toISOString(),
    };
    set((s) => ({ obligations: [created, ...s.obligations] }));
    return created;
  },
  markObligations: (ids, status) =>
    set((s) => ({
      obligations: s.obligations.map((o) =>
        ids.includes(o.id) ? { ...o, status } : o,
      ),
    })),

  cycleId: OPEN_CYCLE.id,
  cycleStatus: OPEN_CYCLE.status,
  setCycleStatus: (cycleStatus) => set({ cycleStatus }),
  netPositions: null,
  setNetPositions: (netPositions) => set({ netPositions }),

  legs: [],
  setLegs: (legs) => set({ legs }),
  setLegStatus: (ids, status) =>
    set((s) => ({
      legs: s.legs.map((l) =>
        ids === "all" || ids.includes(l.id) ? { ...l, status } : l,
      ),
    })),
  txHash: null,
  setTxHash: (txHash) => set({ txHash }),
  applySettlementBalances: () => {
    const { legs, balances } = get();
    const next = { ...balances };
    for (const leg of legs) {
      next[leg.from] -= leg.amount;
      next[leg.to] += leg.amount;
    }
    set({ balances: next });
  },

  policyEvents: [],
  addPolicyEvent: (e) =>
    set((s) => ({
      policyEvents: [
        { ...e, id: `pe-${++seq}`, at: new Date().toISOString() },
        ...s.policyEvents,
      ],
    })),

  activity: SEED_ACTIVITY,
  logActivity: (e) =>
    set((s) => ({
      activity: [
        { ...e, id: `ev-${++seq}`, at: new Date().toISOString() },
        ...s.activity,
      ],
    })),

  toasts: [],
  pushToast: (kind, message) => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));
    // Auto-dismiss within the 3–5s toast window.
    setTimeout(() => get().dismissToast(id), 4500);
  },
  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Convenience lookup used across the app screens. In a sandbox session the
 *  display name/shortName are overridden with the tenant's chosen labels. */
export function partyById(id: PartyId) {
  const base = PARTIES.find((p) => p.id === id)!;
  const label = useNetChain.getState().partyLabels?.[id];
  return label ? { ...base, name: label.name, shortName: label.shortName } : base;
}
