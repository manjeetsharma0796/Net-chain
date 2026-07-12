import { NextRequest, NextResponse } from "next/server";
import { getPartiesLive, isLive } from "@/lib/ledger-server";
import { PARTIES } from "@/lib/mock/data";
import { PartyId } from "@/lib/types";

// Real invoice extraction (T16). The dropped image goes to an NVIDIA NIM vision
// model server-side; the key never reaches the browser. Returns the same
// ExtractedInvoice shape as the mock (lib/api.ts), so the client falls back to
// the mock on any 503/error. PDFs are handled by the mock (this route is images).
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const KEY = process.env.NIM_API_KEY;
const BASE = process.env.NIM_BASE ?? "https://integrate.api.nvidia.com/v1";
const MODEL = process.env.NIM_VISION_MODEL ?? "meta/llama-3.2-11b-vision-instruct";

/** Pull the first {...} object out of a model reply (tolerates code fences/prose). */
function parseJsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  if (!KEY) {
    // 503 -> the dropzone falls back to the mock extractor.
    return NextResponse.json({ error: "AI extraction not configured" }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    imageDataUrl?: string;
    currentParty?: string;
  };
  const imageDataUrl = body.imageDataUrl ?? "";
  if (!imageDataUrl.startsWith("data:image/")) {
    return NextResponse.json({ error: "expected a data:image/* URL" }, { status: 400 });
  }

  // Name the counterparties by their REAL on-chain identity in live mode (Carol/
  // Investor/SME), so the vision model matches the actual invoice, not the mock
  // labels. Falls back to the mock names when the ledger isn't configured.
  const nameById = new Map<string, string>(
    isLive()
      ? getPartiesLive().map((p) => [p.id, p.baseName])
      : PARTIES.map((p) => [p.id, p.name]),
  );
  const displayName = (id: string) => nameById.get(id) ?? id;

  const candidates = PARTIES.filter((p) => p.id !== body.currentParty);
  const list = candidates.map((p) => `${p.id} = ${displayName(p.id)}`).join("; ");
  const ids = candidates.map((p) => p.id).join(", ");
  const prompt =
    `Extract the single invoice in this image. The counterparty is one of these known ` +
    `companies: ${list}. Return ONLY minified JSON, no prose and no code fence, with keys: ` +
    `counterparty (exactly one of these ids: ${ids}), amount (number, digits only, no currency ` +
    `symbol or thousands separators), reference (the invoice number plus a short description), ` +
    `dueDate (YYYY-MM-DD), confidence (0 to 1). If a field is unreadable, give your best guess ` +
    `and lower the confidence.`;

  let raw = "";
  try {
    const r = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
        max_tokens: 300,
        temperature: 0,
      }),
      cache: "no-store",
    });
    if (!r.ok) {
      return NextResponse.json({ error: `NIM ${r.status}` }, { status: 502 });
    }
    const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
    raw = j.choices?.[0]?.message?.content ?? "";
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "extraction failed" },
      { status: 502 },
    );
  }

  const parsed = parseJsonObject(raw);
  if (!parsed) {
    return NextResponse.json({ error: "model did not return JSON" }, { status: 502 });
  }

  // Map counterparty to a real PartyId: accept a returned id, else match the
  // name in the raw text, else default to the first candidate (an arbitrary
  // guess, forced low-confidence below so the review UI flags it).
  let counterparty = String(parsed.counterparty ?? "") as PartyId;
  let forcedLowConfidence = false;
  if (!candidates.some((p) => p.id === counterparty)) {
    const low = raw.toLowerCase();
    const matched = candidates.find((p) => low.includes(displayName(p.id).toLowerCase()))?.id;
    counterparty = matched ?? candidates[0].id;
    forcedLowConfidence = !matched;
  }

  const amount = Number(parsed.amount);
  const confidence = Number(parsed.confidence);
  let clampedConfidence = Number.isFinite(confidence) ? Math.min(Math.max(confidence, 0), 1) : 0.5;
  if (forcedLowConfidence) clampedConfidence = Math.min(clampedConfidence, 0.3);
  return NextResponse.json({
    counterparty,
    amount: Number.isFinite(amount) ? amount : 0,
    reference: String(parsed.reference ?? ""),
    dueDate: String(parsed.dueDate ?? ""),
    confidence: clampedConfidence,
  });
}
