import { NextResponse } from "next/server";

// T27: real Canton Coin market data for the dashboard. CoinGecko's free tier is
// not licensed for production and rate-limits cloud IPs, so this route (a) caches
// for 5 minutes so we make very few upstream calls, and (b) goes through a proxy
// chain (direct, then r.jina.ai) so a single source timeout does not blank the
// tile. Topology stats (validators, governance, rounds) are not on CoinGecko and
// stay in the mock Scan snapshot; only price and market cap are live here.
export const dynamic = "force-dynamic";

const CG =
  "https://api.coingecko.com/api/v3/simple/price?ids=canton-network,xreserve-bridged-usdc-canton" +
  "&vs_currencies=usd&include_market_cap=true&include_24hr_change=true";

const TTL = 5 * 60 * 1000;
let cache: { at: number; body: unknown } | null = null;

type Cg = Record<string, { usd?: number; usd_market_cap?: number; usd_24h_change?: number }>;

/** Fetch the CoinGecko payload via a source chain; returns parsed JSON or null. */
async function fetchCg(): Promise<Cg | null> {
  const sources: Array<() => Promise<Cg | null>> = [
    // direct
    async () => {
      const r = await fetch(CG, { signal: AbortSignal.timeout(6000), cache: "no-store" });
      return r.ok ? ((await r.json()) as Cg) : null;
    },
    // proxy fallback: r.jina.ai wraps the body in a markdown envelope (often
    // { data: { text } }, but the text itself may also carry markdown around
    // the JSON), so pull the JSON out by its outermost braces instead of
    // assuming either layer is clean JSON.
    async () => {
      const r = await fetch("https://r.jina.ai/" + CG, {
        signal: AbortSignal.timeout(9000),
        headers: { "X-Return-Format": "text" },
        cache: "no-store",
      });
      if (!r.ok) return null;
      const body = await r.text();
      let text = body;
      try {
        const envelope = JSON.parse(body) as { data?: { text?: string } };
        if (envelope.data?.text) text = envelope.data.text;
      } catch {
        /* body is not the { data: { text } } envelope, use it as-is */
      }
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start < 0 || end <= start) return null;
      try {
        return JSON.parse(text.slice(start, end + 1)) as Cg;
      } catch {
        return null;
      }
    },
  ];
  for (const src of sources) {
    try {
      const v = await src();
      if (v && v["canton-network"]?.usd != null) return v;
    } catch {
      /* try next source */
    }
  }
  return null;
}

export async function GET() {
  if (cache && Date.now() - cache.at < TTL) {
    return NextResponse.json({ ...(cache.body as object), cached: true });
  }
  const cg = await fetchCg();
  if (!cg) {
    // Serve the last good value if we have one, else 503 so the client keeps the mock.
    if (cache) return NextResponse.json({ ...(cache.body as object), stale: true });
    return NextResponse.json({ error: "market data unavailable" }, { status: 503 });
  }
  const cc = cg["canton-network"] ?? {};
  const usdcx = cg["xreserve-bridged-usdc-canton"] ?? {};
  const body = {
    ccPriceUsd: cc.usd ?? null,
    ccMarketCapUsd: cc.usd_market_cap ?? null,
    cc24hChange: cc.usd_24h_change ?? null,
    usdcxPriceUsd: usdcx.usd ?? null,
  };
  cache = { at: Date.now(), body };
  return NextResponse.json(body);
}
