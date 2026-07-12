import { NextRequest, NextResponse } from "next/server";
import { isLive, reseedOpenLedger } from "@/lib/ledger-server";

// Force the demo to its clean OPEN state, fast. Unlike /api/cron/net this does
// NOT settle first, so it works even when the demo is already settled or has
// accumulated stale contracts (duplicate policies, orphan obligations). It
// reuses reseedOpenLedger (parallel archive-all + reseed), so it converges to
// exactly 3 accounts, 3 policies, and the 6 canonical accepted obligations.
//
// Secret-gated with CRON_SECRET (same as /api/cron/net): a reset endpoint must
// not be an open write surface.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!isLive()) {
    return NextResponse.json({ skipped: "ledger not configured" }, { status: 503 });
  }
  try {
    const reseeded = await reseedOpenLedger();
    return NextResponse.json({ ok: true, reseeded });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
