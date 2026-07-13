import "server-only";

/**
 * Server-only JSON Ledger API v2 client for the 5N devnet validator. Holds the
 * M2M token (the CLIENT_SECRET never leaves the server) and maps the frontend's
 * PartyId to the allocated ledger party ids. Route handlers under
 * app/api/ledger/* are thin wrappers over the high-level functions at the bottom.
 *
 * Everything degrades cleanly: if the env isn't configured (no secret / no
 * party ids), `isLive()` is false and the routes return 503 so the client falls
 * back to the mock. Mirrors the proven flow in daml/deploy.sh.
 */

import { buildSettlementLegs } from "@/lib/api";
import { LedgerContract, PARTY_IDS, toAccount, toNetPosition, toObligation } from "@/lib/ledger-map";
import { ActivityEvent, NetPosition, Obligation, PartyId, SettlementLeg } from "@/lib/types";

const env = process.env;
const BASE = env.BASE ?? "";
const PKG = env.NETCHAIN_PKG_ID ?? "";
const USER_ID = env.USER_ID ?? "6";

/** frontend PartyId + operator → allocated ledger party id (from .env). */
function ledgerId(p: PartyId | "operator"): string {
  const map: Record<string, string | undefined> = {
    operator: env.NETCHAIN_OPERATOR,
    "company-a": env.NETCHAIN_COMPANY_A,
    "company-b": env.NETCHAIN_COMPANY_B,
    "company-c": env.NETCHAIN_COMPANY_C,
  };
  return map[p] ?? "";
}

const REVERSE: Array<[string, PartyId]> = [
  [env.NETCHAIN_COMPANY_A ?? "\0", "company-a"],
  [env.NETCHAIN_COMPANY_B ?? "\0", "company-b"],
  [env.NETCHAIN_COMPANY_C ?? "\0", "company-c"],
];
function toPartyId(id: string): PartyId | null {
  return REVERSE.find(([lid]) => lid === id)?.[1] ?? null;
}

/** Live only when the secret and all four party ids are present. */
export function isLive(): boolean {
  return Boolean(
    BASE &&
      PKG &&
      env.CLIENT_SECRET &&
      env.NETCHAIN_OPERATOR &&
      env.NETCHAIN_COMPANY_A &&
      env.NETCHAIN_COMPANY_B &&
      env.NETCHAIN_COMPANY_C,
  );
}

/** Real ledger party identities (WR8): the allocated party id + its base name
 *  (the substring before '::') for a/b/c + operator. Lets the frontend label the
 *  slots with the ACTUAL on-ledger parties in live mode, not the mock names.
 *  Callers gate on isLive(); the route returns 503 when not live. */
export function getPartiesLive(): Array<{ id: PartyId | "operator"; ledgerId: string; baseName: string }> {
  const ids: Array<PartyId | "operator"> = ["company-a", "company-b", "company-c", "operator"];
  return ids.map((id) => {
    const lid = ledgerId(id);
    return { id, ledgerId: lid, baseName: lid.split("::")[0] ?? "" };
  });
}

const tid = (t: string) => `${PKG}:NetChain:${t}`; // command form (G1)
const fid = (t: string) => `#netchain:NetChain:${t}`; // filter form (G1)

export class LedgerError extends Error {}

/* -------------------------------------------------------------------------- */
/* token (cached ~8h)                                                         */
/* -------------------------------------------------------------------------- */
let cached: { token: string; exp: number } | null = null;

async function token(): Promise<string> {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: env.CLIENT_ID ?? "",
    client_secret: env.CLIENT_SECRET ?? "",
    audience: env.AUDIENCE ?? "",
    scope: env.SCOPE ?? "",
  });
  const r = await fetch(env.TOKEN_ENDPOINT ?? "", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!r.ok) throw new LedgerError(`token request failed: ${r.status}`);
  const j = (await r.json()) as { access_token: string };
  // Tokens live ~8h; cache for 7h to stay safely inside the window.
  cached = { token: j.access_token, exp: Date.now() + 7 * 3600_000 };
  return j.access_token;
}

async function post(path: string, payload: unknown): Promise<unknown> {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await token()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const text = await r.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  // JSON API surfaces errors as {code, cause} with 4xx/5xx (G8).
  if (!r.ok || (isRecord(json) && "code" in json && "cause" in json)) {
    throw new LedgerError(
      isRecord(json) ? String(json.cause ?? json.code) : String(json),
    );
  }
  return json;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

async function ledgerEnd(): Promise<number> {
  const r = await fetch(`${BASE}/v2/state/ledger-end`, {
    headers: { Authorization: `Bearer ${await token()}` },
    cache: "no-store",
  });
  const j = (await r.json()) as { offset: number };
  return j.offset;
}

/* -------------------------------------------------------------------------- */
/* low-level commands                                                         */
/* -------------------------------------------------------------------------- */
function submit(actAs: string, command: unknown): Promise<{ updateId?: string }> {
  return post("/v2/commands/submit-and-wait", {
    actAs: [actAs],
    readAs: [],
    userId: USER_ID,
    commandId: `nc-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    deduplicationPeriod: { Empty: {} },
    commands: [command],
  }) as Promise<{ updateId?: string }>;
}

function create(actAs: string, template: string, args: unknown) {
  return submit(actAs, {
    CreateCommand: { templateId: tid(template), createArguments: args },
  });
}

function exercise(
  actAs: string,
  template: string,
  contractId: string,
  choice: string,
  choiceArgument: unknown,
) {
  return submit(actAs, {
    ExerciseCommand: { templateId: tid(template), contractId, choice, choiceArgument },
  });
}

/** Query one template's active contracts from a party's projection. */
async function queryAcs(party: string, template: string): Promise<LedgerContract[]> {
  const activeAtOffset = await ledgerEnd();
  const res = await post("/v2/state/active-contracts", {
    filter: {
      filtersByParty: {
        [party]: {
          cumulative: [
            {
              identifierFilter: {
                TemplateFilter: {
                  value: { templateId: fid(template), includeCreatedEventBlob: false },
                },
              },
            },
          ],
        },
      },
    },
    verbose: true,
    activeAtOffset,
  });
  return extractContracts(res);
}

/** Pull createdEvents out of an ACS response (array or NDJSON, per G8). */
function extractContracts(res: unknown): LedgerContract[] {
  const items: unknown[] = Array.isArray(res) ? res : [res];
  const out: LedgerContract[] = [];
  for (const item of items) {
    if (!isRecord(item)) continue;
    const entry = item.contractEntry;
    const created =
      isRecord(entry) &&
      isRecord(entry.JsActiveContract) &&
      isRecord(entry.JsActiveContract.createdEvent)
        ? (entry.JsActiveContract.createdEvent as Record<string, unknown>)
        : null;
    if (!created) continue;
    out.push({
      contractId: String(created.contractId ?? ""),
      payload: isRecord(created.createArgument)
        ? (created.createArgument as Record<string, unknown>)
        : {},
    });
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* high-level API used by the route handlers                                  */
/* -------------------------------------------------------------------------- */

/** Obligations in `party`'s ledger projection (privacy enforced by the node).
 *  Pass "operator" for the ground-truth set: the operator is observer on every
 *  Obligation, so its ACS returns all of them with their real contract ids. */
export async function listObligations(party: PartyId | "operator"): Promise<Obligation[]> {
  const rows = await queryAcs(ledgerId(party), "Obligation");
  return rows.map((c) => toObligation(c, toPartyId)).filter((o): o is Obligation => o !== null);
}

/** Direct lookup, returns null if `party` isn't a stakeholder (real not-found). */
export async function getContract(
  party: PartyId,
  contractId: string,
): Promise<Obligation | null> {
  const all = await listObligations(party);
  return all.find((o) => o.contractId === contractId) ?? null;
}

/** The single NetPosition `party` is allowed to see (latest cycle). */
export async function getNetPosition(party: PartyId): Promise<NetPosition | null> {
  const rows = await queryAcs(ledgerId(party), "NetPosition");
  const mapped = rows
    .map((c) => toNetPosition(c, toPartyId))
    .filter((n): n is NetPosition => n !== null && n.party === party);
  return mapped.length ? mapped[mapped.length - 1] : null;
}

/** The Account balance for `party` from the ledger (owner-scoped ACS). */
export async function getAccountBalance(party: PartyId): Promise<number | null> {
  const rows = await queryAcs(ledgerId(party), "Account");
  const acct = rows.map((c) => toAccount(c, toPartyId)).find((a) => a?.party === party);
  return acct?.balance ?? null;
}

/** All three Account balances in one operator-scoped ACS call (operator is signatory). */
export async function getAllAccountBalances(): Promise<Partial<Record<PartyId, number>>> {
  const rows = await queryAcs(ledgerId("operator"), "Account");
  const result: Partial<Record<PartyId, number>> = {};
  for (const c of rows) {
    const acct = toAccount(c, toPartyId);
    if (acct) result[acct.party] = acct.balance;
  }
  return result;
}

/* -------------------------------------------------------------------------- */
/* transaction history: real on-chain activity feed + cycle status            */
/* -------------------------------------------------------------------------- */

type HistoryEvent = {
  kind: "created" | "archived";
  template: string; // last id segment, e.g. "Obligation"
  contractId: string;
  payload: Record<string, unknown>;
};
type HistoryTx = {
  updateId: string;
  commandId: string;
  effectiveAt: string;
  events: HistoryEvent[];
};

/** Parse a /v2/updates/flats response into HistoryTx[], ledger order (oldest-first). */
function parseHistoryTxs(res: unknown): HistoryTx[] {
  const items: unknown[] = res === null ? [] : Array.isArray(res) ? res : [res];
  const txs: HistoryTx[] = [];
  for (const item of items) {
    if (!isRecord(item) || !isRecord(item.update)) continue;
    const wrap = item.update.Transaction;
    const tx = isRecord(wrap) && isRecord(wrap.value) ? wrap.value : null;
    if (!tx) continue;
    const rawEvents = Array.isArray(tx.events) ? tx.events : [];
    const events: HistoryEvent[] = [];
    for (const ev of rawEvents) {
      if (!isRecord(ev)) continue;
      const k = Object.keys(ev)[0];
      const v = isRecord(ev[k]) ? (ev[k] as Record<string, unknown>) : {};
      events.push({
        kind: k === "CreatedEvent" ? "created" : "archived",
        template: String(v.templateId ?? "").split(":").pop() ?? "",
        contractId: String(v.contractId ?? ""),
        payload: isRecord(v.createArgument) ? (v.createArgument as Record<string, unknown>) : {},
      });
    }
    txs.push({
      updateId: String(tx.updateId ?? ""),
      commandId: String(tx.commandId ?? ""),
      effectiveAt: String(tx.effectiveAt ?? ""),
      events,
    });
  }
  return txs;
}

/**
 * Recent flat transactions from the operator's projection, newest-first.
 * /v2/updates/flats errors past the JSON API's ~200-element node limit, so we
 * never scan full history. Instead we page backwards from ledgerEnd in fixed
 * offset windows (each well under the limit) and accumulate matching
 * Transactions until we have `want` of them or a bounded number of windows are
 * exhausted. If a window still trips the limit, we halve it and retry, so this
 * stays reliable on a busy shared devnet where the old fraction-widening loop
 * yielded empty.
 */
async function updateHistory(want = 25): Promise<HistoryTx[]> {
  const end = await ledgerEnd();
  const filter = {
    filtersByParty: {
      [ledgerId("operator")]: {
        cumulative: [
          { identifierFilter: { WildcardFilter: { value: { includeCreatedEventBlob: false } } } },
        ],
      },
    },
  };
  const CHUNK = 150; // offsets/window: at most ~150 updates, safely under ~200
  const MAX_WINDOWS = 10; // bound the backward scan (~1500 offsets of recent history)
  const out: HistoryTx[] = [];
  let hi = end;
  for (let i = 0; i < MAX_WINDOWS && hi > 0 && out.length < want; i++) {
    let lo = Math.max(0, hi - CHUNK);
    let res: unknown;
    for (;;) {
      try {
        res = await post("/v2/updates/flats", { beginExclusive: lo, endInclusive: hi, filter, verbose: true });
        break;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // Window still too wide: shrink it and retry rather than bail to empty.
        if (/node limit|matching elements/i.test(msg) && hi - lo > 1) {
          lo = hi - Math.ceil((hi - lo) / 2);
          continue;
        }
        throw e;
      }
    }
    // Ledger returns oldest-first within a window; reverse to newest-first so
    // `out` stays newest-first as we walk to successively older windows.
    out.push(...parseHistoryTxs(res).reverse());
    hi = lo;
  }
  return out;
}

const PARTY_LABEL: Record<string, string> = {
  "company-a": "Company A",
  "company-b": "Company B",
  "company-c": "Company C",
};
function partyLabel(id: string): string {
  return PARTY_LABEL[toPartyId(id) ?? ""] ?? "a counterparty";
}

/** Map one transaction to a human activity line, or null to skip it. */
function mapTx(tx: HistoryTx): ActivityEvent | null {
  const created = tx.events.filter((e) => e.kind === "created");
  const archived = tx.events.filter((e) => e.kind === "archived");
  const has = (t: string) => created.some((e) => e.template === t);
  const base = { id: tx.updateId, at: tx.effectiveAt };

  // Settle consumes NetPositions and re-creates Accounts with moved balances.
  if (
    archived.some((e) => e.template === "NetPosition") ||
    (has("Account") && archived.some((e) => e.template === "Account"))
  ) {
    const n = created.filter((e) => e.template === "Account").length;
    return {
      ...base,
      actor: "operator",
      kind: "settlement",
      message: `Settlement committed atomically, ${n || "all"} balances moved on-ledger`,
    };
  }
  if (has("NettingCycle")) {
    const cyc = created.find((e) => e.template === "NettingCycle");
    const cids = cyc && Array.isArray(cyc.payload.obligationCids) ? cyc.payload.obligationCids : [];
    return { ...base, actor: "operator", kind: "cycle", message: `Netting cycle opened over ${cids.length} obligations` };
  }
  if (has("NetPosition")) {
    const n = created.filter((e) => e.template === "NetPosition").length;
    return { ...base, actor: "operator", kind: "cycle", message: `Net positions computed for ${n} participants` };
  }
  if (has("Obligation")) {
    const p = created.find((e) => e.template === "Obligation")!.payload;
    const actor = toPartyId(String(p.obligor ?? "")) ?? "operator";
    const amt = Number(p.amount ?? 0).toLocaleString("en-US");
    const ref = p.reference ? `, ref ${p.reference}` : "";
    return {
      ...base,
      actor,
      kind: "obligation",
      message: `Obligation recorded: ${amt} USDCx (${partyLabel(String(p.obligor ?? ""))} to ${partyLabel(String(p.obligee ?? ""))})${ref}`,
    };
  }
  if (has("Account")) {
    const n = created.filter((e) => e.template === "Account").length;
    return { ...base, actor: "operator", kind: "network", message: `Treasury accounts funded for ${n} parties` };
  }
  if (has("TreasuryPolicy")) {
    return { ...base, actor: "operator", kind: "policy", message: "Treasury policy cap registered on-ledger" };
  }
  return null;
}

/** Real on-chain activity feed from transaction history, newest-first (max `limit`). */
export async function getActivityLive(limit = 8): Promise<ActivityEvent[]> {
  const txs = await updateHistory(limit);
  const out: ActivityEvent[] = [];
  for (const tx of txs) {
    const ev = mapTx(tx);
    if (ev) out.push(ev);
    if (out.length >= limit) break;
  }
  return out;
}

/** Re-fetch a settle updateId from the live validator, proving it is a real
 *  on-ledger transaction (not a mock). Content stays private; this confirms the
 *  id exists in the validator's transaction stream, fetched live on demand. */
export async function verifyUpdate(updateId: string): Promise<{
  confirmed: boolean;
  effectiveAt: string | null;
  validator: string;
}> {
  let validator = BASE;
  try {
    validator = new URL(BASE).host;
  } catch {
    /* keep BASE */
  }
  if (!updateId) return { confirmed: false, effectiveAt: null, validator };
  try {
    // Fetch this exact update by id (O(1)). This must NOT scan the update
    // history: /v2/updates/flats caps at 200 elements and errors once the
    // ledger has more, so a history scan silently fails on a busy validator.
    const res = await post("/v2/updates/update-by-id", {
      updateId,
      updateFormat: {
        includeTransactions: {
          eventFormat: {
            filtersByParty: {
              [ledgerId("operator")]: {
                cumulative: [
                  { identifierFilter: { WildcardFilter: { value: { includeCreatedEventBlob: false } } } },
                ],
              },
            },
            verbose: false,
          },
          transactionShape: "TRANSACTION_SHAPE_ACS_DELTA",
        },
      },
    });
    const wrap =
      isRecord(res) && isRecord(res.update) ? (res.update.Transaction as unknown) : null;
    const tx = isRecord(wrap) && isRecord(wrap.value) ? wrap.value : null;
    const foundId = tx && typeof tx.updateId === "string" ? tx.updateId : null;
    const effectiveAt = tx && typeof tx.effectiveAt === "string" ? tx.effectiveAt : null;
    return { confirmed: foundId === updateId, effectiveAt, validator };
  } catch {
    // A non-existent update id returns NOT_FOUND (post throws): a real "not
    // confirmed", exactly what we want to report for a bogus/forged id.
    return { confirmed: false, effectiveAt: null, validator };
  }
}

/** Live netting-cycle status from the ACS (operator is signatory). */
export async function getCycleStatusLive(): Promise<{
  status: "open" | "settled" | "none";
  ref: string | null;
}> {
  const rows = await queryAcs(ledgerId("operator"), "NettingCycle");
  if (!rows.length) return { status: "none", ref: null };
  const open = rows.find((c) => c.payload.settled !== true);
  const chosen = open ?? rows[rows.length - 1];
  return { status: open ? "open" : "settled", ref: chosen.contractId ? chosen.contractId.slice(-8) : null };
}

/** All net positions from the most recent cycle, recovered from history so the
 * audit view survives Settle archiving them. Operator-scoped, newest cycle. */
export async function getLastCycleNetPositionsLive(): Promise<NetPosition[]> {
  const txs = await updateHistory(); // newest-first
  for (const tx of txs) {
    const nps = tx.events.filter((e) => e.kind === "created" && e.template === "NetPosition");
    if (nps.length) {
      return nps
        .map((e) => toNetPosition({ contractId: e.contractId, payload: e.payload }, toPartyId))
        .filter((n): n is NetPosition => n !== null);
    }
  }
  return [];
}

/**
 * Complete settled net-leg history, newest settlement first. `Settle` archives
 * its cycle's NetPositions, so every transaction that archives NetPositions IS a
 * settlement: the tx `updateId` is the real Settle id, and each archived contract
 * id resolves (via the earlier ComputeNetPositions create) to that cycle's net
 * positions, from which the net legs are rebuilt. Replaces the last-cycle-only
 * recovery, which left every party outside the most recent settle with an empty
 * audit export. Each leg carries its own cycleId + updateId so a multi-cycle CSV
 * is still verifiable row by row.
 */
export async function getSettledLegsLive(): Promise<SettlementLeg[]> {
  const txs = await updateHistory(60); // newest-first
  // Index every NetPosition create by contract id, keeping its cycleId.
  const created = new Map<string, { np: NetPosition; cycleId: string }>();
  for (const tx of txs) {
    for (const e of tx.events) {
      if (e.kind === "created" && e.template === "NetPosition") {
        const np = toNetPosition({ contractId: e.contractId, payload: e.payload }, toPartyId);
        if (np) created.set(e.contractId, { np, cycleId: String(e.payload.cycleId ?? "") });
      }
    }
  }
  const out: SettlementLeg[] = [];
  const seen = new Set<string>();
  for (const tx of txs) {
    const archived = tx.events.filter((e) => e.kind === "archived" && e.template === "NetPosition");
    const nps: NetPosition[] = [];
    let cycleId = "";
    for (const e of archived) {
      const c = created.get(e.contractId);
      if (c) {
        nps.push(c.np);
        cycleId = c.cycleId;
      }
    }
    if (!nps.length || seen.has(cycleId)) continue; // not a settlement, or already emitted
    seen.add(cycleId);
    for (const leg of buildSettlementLegs(nps)) {
      out.push({ ...leg, status: "settled", cycleId, updateId: tx.updateId });
    }
  }
  return out;
}

/**
 * Shared by computeNetPositionsOnLedger and runAndSettle: build a cycle id,
 * create a NettingCycle over the current open obligations, find its contract
 * id via ACS, and exercise ComputeNetPositions. ComputeNetPositions is a
 * non-consuming choice, so the cycle contract stays active for a subsequent Settle.
 *
 * `selectedCids` scopes the cycle to exactly the obligations the operator picked
 * (WR4: the ledger must net only the in-scope set, not everything, or a party
 * outside the selection is mis-attributed as paying). Default: all open.
 */
async function openCycleAndCompute(selectedCids?: string[]): Promise<{
  op: string;
  cycleId: string;
  cycleCid: string;
}> {
  const op = ledgerId("operator");
  const parties = PARTY_IDS.map(ledgerId);
  const cycleId = `cyc-${Date.now()}`;

  const open = (await queryAcs(op, "Obligation")).filter((c) => c.payload.settled !== true);
  const scoped = selectedCids?.length
    ? open.filter((c) => selectedCids.includes(c.contractId))
    : open;
  if (scoped.length < 2) throw new LedgerError("need at least two open obligations to net");
  const obligationCids = scoped.map((c) => c.contractId);

  await create(op, "NettingCycle", { operator: op, participants: parties, obligationCids, settled: false });
  const cycleCid = latestUnsettled(await queryAcs(op, "NettingCycle"));
  if (!cycleCid) throw new LedgerError("netting cycle not found after create");

  await exercise(op, "NettingCycle", cycleCid, "ComputeNetPositions", { cycleId });

  return { op, cycleId, cycleCid };
}

/**
 * Create a NettingCycle on-ledger, exercise ComputeNetPositions, and return
 * the resulting NetPositions. Non-consuming choice, the cycle contract stays
 * active so T29's Settle can use the same contractId.
 */
export async function computeNetPositionsOnLedger(obligationCids?: string[]): Promise<{
  cycleId: string;
  netPositions: NetPosition[];
}> {
  const { op, cycleId } = await openCycleAndCompute(obligationCids);

  const npRows = await queryAcs(op, "NetPosition");
  const netPositions = npRows
    .map((c) => toNetPosition(c, toPartyId))
    .filter((n): n is NetPosition => n !== null && n.cycleId === cycleId);

  return { cycleId, netPositions };
}

export async function createObligation(input: {
  obligor: PartyId;
  obligee: PartyId;
  amount: number;
  reference: string;
  dueDate: string;
  source?: "agent" | "manual";
}): Promise<{ updateId?: string }> {
  return create(ledgerId(input.obligor), "Obligation", {
    operator: ledgerId("operator"),
    obligor: ledgerId(input.obligor),
    obligee: ledgerId(input.obligee),
    amount: input.amount.toFixed(1), // Decimal as string (G2)
    reference: input.reference,
    dueDate: input.dueDate,
    settled: false,
    // Provenance + a UETR-style trace ref, stamped at creation (v1.0.2).
    source: input.source ?? "manual",
    uetr: crypto.randomUUID(),
    // Bilateral consent (v1.0.3): a freshly created obligation is PENDING
    // (accepted = null) until the obligee exercises Accept. Only accepted
    // obligations net, so this is the fake-invoice safeguard.
    accepted: null,
  });
}

/**
 * The obligee accepts an obligation (bilateral consent). Runs as the obligee,
 * the choice's controller. Returns the update id. Only accepted obligations net.
 */
export async function acceptObligation(input: {
  obligor: PartyId;
  contractId: string;
}): Promise<{ updateId?: string }> {
  // The obligor (payer) accepts, so a payee cannot self-approve an invoice (WR5).
  return exercise(
    ledgerId(input.obligor),
    "Obligation",
    input.contractId,
    "Accept",
    {},
  );
}

/* ---- maker-checker treasury cap governance (T65) ------------------------- */

/** Maker step: the party proposes a new cap on its own TreasuryPolicy. Creates a
 *  TreasuryPolicyProposal the operator must approve; the cap does not change yet. */
export async function proposeCapChange(input: {
  party: PartyId;
  newCap: number;
}): Promise<{ updateId?: string }> {
  const op = ledgerId("operator");
  const pol = (await queryAcs(op, "TreasuryPolicy"))
    .filter((c) => c.payload.party === ledgerId(input.party))
    .at(-1);
  if (!pol) throw new LedgerError(`no TreasuryPolicy on-ledger for ${input.party}`);
  return create(ledgerId(input.party), "TreasuryPolicyProposal", {
    operator: op,
    party: ledgerId(input.party),
    currentPolicyCid: pol.contractId,
    newCap: input.newCap.toFixed(1),
  });
}

/** Checker step: the operator approves a pending proposal, atomically retiring the
 *  old policy and issuing the new cap. */
export async function approveCapChange(input: { proposalCid: string }): Promise<{ updateId?: string }> {
  return exercise(ledgerId("operator"), "TreasuryPolicyProposal", input.proposalCid, "ApproveCapChange", {});
}

/** Checker declines a pending proposal; the current cap stands. */
export async function rejectCapChange(input: { proposalCid: string }): Promise<{ updateId?: string }> {
  return exercise(ledgerId("operator"), "TreasuryPolicyProposal", input.proposalCid, "RejectCapChange", {});
}

/** All pending cap-change proposals (operator-scoped ACS). */
export async function listCapProposals(): Promise<
  Array<{ proposalCid: string; party: PartyId; newCap: number }>
> {
  const rows = await queryAcs(ledgerId("operator"), "TreasuryPolicyProposal");
  return rows
    .map((c) => {
      const party = toPartyId(String(c.payload.party ?? ""));
      return party ? { proposalCid: c.contractId, party, newCap: Number(c.payload.newCap ?? 0) } : null;
    })
    .filter((x): x is { proposalCid: string; party: PartyId; newCap: number } => x !== null);
}

/** The on-ledger TreasuryPolicy cap for `party` (operator-scoped ACS), or null if absent. */
export async function getPolicy(
  party: PartyId,
): Promise<{ maxSettlementPerCycle: number } | null> {
  const pols = await queryAcs(ledgerId("operator"), "TreasuryPolicy");
  // Use the LATEST policy for the party (matches proposeCapChange and settle's
  // onePerParty), so a maker-checker cap change is read back consistently.
  const pol = pols.filter((c) => c.payload.party === ledgerId(party)).at(-1);
  return pol ? { maxSettlementPerCycle: Number(pol.payload.maxSettlementPerCycle ?? 0) } : null;
}

/** Exercise CheckSettlement on `party`'s policy, the non-bypassable gate. */
export async function checkPolicy(
  party: PartyId,
  amount: number,
): Promise<{ ok: boolean; ruleFired?: string }> {
  const op = ledgerId("operator");
  const pols = await queryAcs(op, "TreasuryPolicy");
  // Use the LATEST policy for the party (matches proposeCapChange and settle's
  // onePerParty), so a maker-checker cap change is read back consistently.
  const pol = pols.filter((c) => c.payload.party === ledgerId(party)).at(-1);
  if (!pol) throw new LedgerError(`no TreasuryPolicy on-ledger for ${party}`);
  try {
    await exercise(op, "TreasuryPolicy", pol.contractId, "CheckSettlement", {
      amount: amount.toFixed(1),
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Only a real TreasuryPolicy assertion is a policy breach; a network/infra
    // error must propagate instead of being reported as one (M1).
    if (msg.includes("TreasuryPolicy") || msg.includes("breach")) {
      return { ok: false, ruleFired: msg };
    }
    throw e;
  }
}

/**
 * Server-side run of one netting cycle: create a cycle over the current open
 * obligations, ComputeNetPositions, Settle. Returns the real Settle update id
 * and the resulting net positions. Mirrors daml/deploy.sh's cid-via-ACS flow.
 */
export async function runAndSettle(obligationCids?: string[]): Promise<{
  updateId?: string;
  netPositions: NetPosition[];
}> {
  const { op, cycleId, cycleCid } = await openCycleAndCompute(obligationCids);

  // Same filter as computeNetPositionsOnLedger: NetPositions accumulate across
  // cycles, so scope strictly to this cycle's, not "the last 3" (H1/H3).
  const npRows = (await queryAcs(op, "NetPosition")).filter((c) => c.payload.cycleId === cycleId);
  const partyLedgerIds = PARTY_IDS.map(ledgerId);
  const accRows = onePerParty(await queryAcs(op, "Account"), "owner", partyLedgerIds);
  const polRows = onePerParty(await queryAcs(op, "TreasuryPolicy"), "party", partyLedgerIds);
  const cycleCid2 = latestUnsettled(await queryAcs(op, "NettingCycle"));

  const settle = await exercise(op, "NettingCycle", cycleCid2 ?? cycleCid, "Settle", {
    cycleId,
    netPositionCids: npRows.map((c) => c.contractId),
    accountCids: accRows.map((c) => c.contractId),
    policyCids: polRows.map((c) => c.contractId),
  });

  const netPositions = npRows
    .map((c) => toNetPosition(c, toPartyId))
    .filter((n): n is NetPosition => n !== null);
  return { updateId: settle.updateId, netPositions };
}

/**
 * Force the clean, re-runnable OPEN demo state: archive stale cycle state and
 * all obligations, reset the three accounts to 100k, ensure policies, and seed
 * the 6 canonical accepted obligations (gross 460k). The TS twin of
 * `daml/reseed.sh`, used by the auto-net cron to self-heal so the public demo
 * is never left settled after an automated cycle.
 */
export async function reseedOpenLedger(): Promise<{ accounts: number; obligations: number }> {
  const op = ledgerId("operator");
  const caps: Record<PartyId, string> = {
    "company-a": "200000.0",
    "company-b": "500000.0",
    "company-c": "350000.0",
  };
  const OBS: [PartyId, PartyId, string, string][] = [
    ["company-a", "company-b", "120000.0", "AB"],
    ["company-b", "company-c", "95000.0", "BC"],
    ["company-c", "company-a", "150000.0", "CA"],
    ["company-a", "company-c", "40000.0", "AC"],
    ["company-b", "company-a", "25000.0", "BA"],
    ["company-c", "company-b", "30000.0", "CB"],
  ];

  // Snapshot everything in parallel.
  const [nps, cycles, obls, accs, pols] = await Promise.all([
    queryAcs(op, "NetPosition"),
    queryAcs(op, "NettingCycle"),
    queryAcs(op, "Obligation"),
    queryAcs(op, "Account"),
    queryAcs(op, "TreasuryPolicy"),
  ]);

  // Archive stale state concurrently (each contract is independent). Obligations
  // and policies are archived as their signatory (obligor / party); the rest as
  // operator. Best-effort (allSettled): a contract this deployment can't act as
  // the signatory of (e.g. a party user 6 lost actAs for) is left in place rather
  // than aborting the whole reseed. Such leftovers are already settled/orphaned
  // and are excluded from new cycles anyway.
  await Promise.allSettled([
    ...nps.map((c) => exercise(op, "NetPosition", c.contractId, "Archive", {})),
    ...cycles.map((c) => exercise(op, "NettingCycle", c.contractId, "Archive", {})),
    ...accs.map((c) => exercise(op, "Account", c.contractId, "Archive", {})),
    ...obls.map((c) => exercise(String(c.payload.obligor ?? ""), "Obligation", c.contractId, "Archive", {})),
    ...pols.map((c) => exercise(String(c.payload.party ?? ""), "TreasuryPolicy", c.contractId, "Archive", {})),
  ]);

  // Recreate accounts, exactly-3 policies, and the 6 accepted obligations.
  await Promise.all([
    ...PARTY_IDS.map((pid) =>
      create(op, "Account", { operator: op, owner: ledgerId(pid), balance: "100000.0" }),
    ),
    ...PARTY_IDS.map((pid) =>
      create(ledgerId(pid), "TreasuryPolicy", {
        operator: op,
        party: ledgerId(pid),
        maxSettlementPerCycle: caps[pid],
      }),
    ),
    ...OBS.map(([o, e, amt, ref]) =>
      create(ledgerId(o), "Obligation", {
        operator: op,
        obligor: ledgerId(o),
        obligee: ledgerId(e),
        amount: amt,
        reference: ref,
        dueDate: "2026-07-20",
        settled: false,
        source: null,
        uetr: crypto.randomUUID(),
        accepted: true,
      }),
    ),
  ]);

  return { accounts: PARTY_IDS.length, obligations: OBS.length };
}

/**
 * Clear the netting slate: archive every obligation and any open cycle/net
 * state, but keep accounts and policies so the operator can create obligations
 * by hand and still settle. The "start from empty" twin of reseedOpenLedger,
 * for the console's manual "Clear all" control.
 */
export async function clearObligations(): Promise<{ archived: number }> {
  const op = ledgerId("operator");
  const [nps, cycles, obls] = await Promise.all([
    queryAcs(op, "NetPosition"),
    queryAcs(op, "NettingCycle"),
    queryAcs(op, "Obligation"),
  ]);
  await Promise.all([
    ...nps.map((c) => exercise(op, "NetPosition", c.contractId, "Archive", {})),
    ...cycles.map((c) => exercise(op, "NettingCycle", c.contractId, "Archive", {})),
    ...obls.map((c) => exercise(String(c.payload.obligor ?? ""), "Obligation", c.contractId, "Archive", {})),
  ]);
  return { archived: obls.length };
}

function latestUnsettled(rows: LedgerContract[]): string | null {
  const open = rows.filter((c) => c.payload.settled !== true);
  return open.length ? open[open.length - 1].contractId : null;
}

/** One (the latest) active contract per known party id, keyed by `field`. */
function onePerParty(
  rows: LedgerContract[],
  field: "owner" | "party",
  partyIds: string[],
): LedgerContract[] {
  return partyIds
    .map((pid) => rows.filter((r) => r.payload[field] === pid).at(-1))
    .filter((r): r is LedgerContract => r !== undefined);
}
