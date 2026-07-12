import { NextRequest, NextResponse } from "next/server";
import { isLive, reseedOpenLedger, runAndSettle } from "@/lib/ledger-server";

// Auto-net cron: on a schedule (Vercel Cron, see vercel.json), run one funding-
// bounded netting cycle and settle it, then reseed the demo to its clean OPEN
// state so the public URL is never left drained. This is the automated netting
// the operator would otherwise trigger by hand; every on-ledger guarantee
// (TreasuryPolicy cap, per-party funding) still holds, so automating the trigger
// changes nothing about correctness.
//
// Secured with CRON_SECRET: Vercel injects `Authorization: Bearer <CRON_SECRET>`
// on scheduled invocations when the env var is set. Requests without it are
// rejected, so this mutating endpoint is not an open write surface.
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
    const settled = await runAndSettle();
    const reseeded = await reseedOpenLedger();
    return NextResponse.json({
      ok: true,
      settledUpdateId: settled.updateId ?? null,
      netPositions: settled.netPositions,
      reseeded,
      at: req.headers.get("x-vercel-deployment-url") ? "vercel-cron" : "manual",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
