import { NextRequest, NextResponse } from "next/server";
import {
  acceptObligation,
  checkPolicy,
  computeNetPositionsOnLedger,
  createObligation,
  getAccountBalance,
  getActivityLive,
  getAllAccountBalances,
  getContract,
  getCycleStatusLive,
  getLastCycleNetPositionsLive,
  getNetPosition,
  getPolicy,
  isLive,
  listObligations,
  runAndSettle,
  verifyUpdate,
} from "@/lib/ledger-server";
import { PARTY_IDS } from "@/lib/ledger-map";
import { PartyId } from "@/lib/types";

// The ledger client hits the live validator per request; never cache.
export const dynamic = "force-dynamic";

const asParty = (v: string | null): PartyId | null =>
  PARTY_IDS.includes(v as PartyId) ? (v as PartyId) : null;

function guard(): NextResponse | null {
  // 503 → the client shim falls back to the mock (lib/api.ts).
  return isLive()
    ? null
    : NextResponse.json({ error: "ledger not configured" }, { status: 503 });
}

function fail(e: unknown) {
  return NextResponse.json(
    { error: e instanceof Error ? e.message : String(e) },
    { status: 502 },
  );
}

export async function GET(req: NextRequest, { params }: { params: { op: string } }) {
  const blocked = guard();
  if (blocked) return blocked;

  // These need no party param, they query as operator.
  if (params.op === "balances") {
    try {
      return NextResponse.json(await getAllAccountBalances());
    } catch (e) {
      return fail(e);
    }
  }
  if (params.op === "activity") {
    try {
      return NextResponse.json(await getActivityLive());
    } catch (e) {
      return fail(e);
    }
  }
  if (params.op === "cycle-status") {
    try {
      return NextResponse.json(await getCycleStatusLive());
    } catch (e) {
      return fail(e);
    }
  }
  if (params.op === "net-positions") {
    try {
      return NextResponse.json(await getLastCycleNetPositionsLive());
    } catch (e) {
      return fail(e);
    }
  }
  if (params.op === "verify") {
    try {
      return NextResponse.json(await verifyUpdate(req.nextUrl.searchParams.get("updateId") ?? ""));
    } catch (e) {
      return fail(e);
    }
  }

  const q = req.nextUrl.searchParams;
  const party = asParty(q.get("party"));
  if (!party) return NextResponse.json({ error: "bad party" }, { status: 400 });

  try {
    switch (params.op) {
      case "obligations":
        return NextResponse.json(await listObligations(party));
      case "net-position":
        return NextResponse.json(await getNetPosition(party));
      case "balance":
        return NextResponse.json({ balance: await getAccountBalance(party) });
      case "balances":
        return NextResponse.json(await getAllAccountBalances());
      case "policy":
        return NextResponse.json(await getPolicy(party));
      case "contract": {
        const cid = q.get("contractId") ?? "";
        const c = await getContract(party, cid);
        // Real per-party projection miss: the ledger won't confirm it exists.
        return c
          ? NextResponse.json(c)
          : NextResponse.json({ error: "CONTRACT_NOT_FOUND" }, { status: 404 });
      }
      default:
        return NextResponse.json({ error: "unknown op" }, { status: 404 });
    }
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest, { params }: { params: { op: string } }) {
  const blocked = guard();
  if (blocked) return blocked;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  try {
    switch (params.op) {
      case "obligation": {
        const obligor = asParty(String(body.obligor ?? ""));
        const obligee = asParty(String(body.obligee ?? ""));
        if (!obligor || !obligee)
          return NextResponse.json({ error: "bad parties" }, { status: 400 });
        return NextResponse.json(
          await createObligation({
            obligor,
            obligee,
            amount: Number(body.amount ?? 0),
            reference: String(body.reference ?? ""),
            dueDate: String(body.dueDate ?? ""),
            source: body.source === "agent" ? "agent" : "manual",
          }),
        );
      }
      case "accept": {
        const obligee = asParty(String(body.obligee ?? ""));
        const contractId = String(body.contractId ?? "");
        if (!obligee || !contractId)
          return NextResponse.json({ error: "bad accept args" }, { status: 400 });
        return NextResponse.json(await acceptObligation({ obligee, contractId }));
      }
      case "policy-check": {
        const party = asParty(String(body.party ?? ""));
        if (!party) return NextResponse.json({ error: "bad party" }, { status: 400 });
        return NextResponse.json(await checkPolicy(party, Number(body.amount ?? 0)));
      }
      case "run-cycle":
        return NextResponse.json(await computeNetPositionsOnLedger());
      case "settle":
        return NextResponse.json(await runAndSettle());
      default:
        return NextResponse.json({ error: "unknown op" }, { status: 404 });
    }
  } catch (e) {
    return fail(e);
  }
}
