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

import { LedgerContract, toAccount, toNetPosition, toObligation } from "@/lib/ledger-map";
import { NetPosition, Obligation, PartyId } from "@/lib/types";

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

/** Obligations in `party`'s ledger projection (privacy enforced by the node). */
export async function listObligations(party: PartyId): Promise<Obligation[]> {
  const rows = await queryAcs(ledgerId(party), "Obligation");
  return rows.map((c) => toObligation(c, toPartyId)).filter((o): o is Obligation => o !== null);
}

/** Direct lookup — returns null if `party` isn't a stakeholder (real not-found). */
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

export async function createObligation(input: {
  obligor: PartyId;
  obligee: PartyId;
  amount: number;
  reference: string;
  dueDate: string;
}): Promise<{ updateId?: string }> {
  return create(ledgerId(input.obligor), "Obligation", {
    operator: ledgerId("operator"),
    obligor: ledgerId(input.obligor),
    obligee: ledgerId(input.obligee),
    amount: input.amount.toFixed(1), // Decimal as string (G2)
    reference: input.reference,
    dueDate: input.dueDate,
    settled: false,
  });
}

/** Exercise CheckSettlement on `party`'s policy — the non-bypassable gate. */
export async function checkPolicy(
  party: PartyId,
  amount: number,
): Promise<{ ok: boolean; ruleFired?: string }> {
  const op = ledgerId("operator");
  const pols = await queryAcs(op, "TreasuryPolicy");
  const pol = pols.find((c) => c.payload.party === ledgerId(party));
  if (!pol) throw new LedgerError(`no TreasuryPolicy on-ledger for ${party}`);
  try {
    await exercise(op, "TreasuryPolicy", pol.contractId, "CheckSettlement", {
      amount: amount.toFixed(1),
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, ruleFired: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Server-side run of one netting cycle: create a cycle over the current open
 * obligations, ComputeNetPositions, Settle. Returns the real Settle update id
 * and the resulting net positions. Mirrors daml/deploy.sh's cid-via-ACS flow.
 */
export async function runAndSettle(): Promise<{
  updateId?: string;
  netPositions: NetPosition[];
}> {
  const op = ledgerId("operator");
  const parties = (["company-a", "company-b", "company-c"] as PartyId[]).map(ledgerId);
  const cycleId = `cyc-${Date.now()}`;

  const open = (await queryAcs(op, "Obligation")).filter((c) => c.payload.settled !== true);
  if (open.length < 2) throw new LedgerError("need at least two open obligations to net");
  const obligationCids = open.map((c) => c.contractId);

  await create(op, "NettingCycle", { operator: op, participants: parties, obligationCids, settled: false });
  const cycleCid = latestUnsettled(await queryAcs(op, "NettingCycle"));
  if (!cycleCid) throw new LedgerError("netting cycle not found after create");

  await exercise(op, "NettingCycle", cycleCid, "ComputeNetPositions", { cycleId });

  const npRows = (await queryAcs(op, "NetPosition")).slice(-3);
  const accRows = (await queryAcs(op, "Account")).slice(-3);
  const polRows = (await queryAcs(op, "TreasuryPolicy")).slice(-3);
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

function latestUnsettled(rows: LedgerContract[]): string | null {
  const open = rows.filter((c) => c.payload.settled !== true);
  return open.length ? open[open.length - 1].contractId : null;
}
