// NetChain DEEP-DIVE deck (pptxgenjs). Diagrams + real live UI screenshots.
// Run: node deep-dive-deck.mjs  ->  NetChain-DeepDive.pptx
// Screenshots live in ./screens (captured live via Playwright from prod).
import pptxgen from "pptxgenjs";

const C = {
  bg: "0B0F14", card: "141C25", cardEdge: "223040",
  text: "E6EDF3", muted: "8FA6B8", faint: "5F7486",
  accent: "7FA6C9", green: "38E1A4", amber: "F5C451", red: "E8846B", white: "FFFFFF",
};
const FONT = "Segoe UI", MONO = "Consolas";
const W = 13.333, H = 7.5, MX = 0.7;
const IMG_AR = 900 / 1440; // screenshot aspect (h/w)

const pptx = new pptxgen();
pptx.defineLayout({ name: "W", width: W, height: H });
pptx.layout = "W";
pptx.author = "NetChain";
pptx.title = "NetChain, a deep dive";

/* ---------- helpers ------------------------------------------------------ */
function slide({ kicker, title, titleSize = 27 }) {
  const s = pptx.addSlide();
  s.background = { color: C.bg };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.06, fill: { color: C.accent } });
  if (kicker)
    s.addText(kicker.toUpperCase(), { x: MX, y: 0.42, w: W - 2 * MX, h: 0.3, fontFace: FONT, fontSize: 11, color: C.accent, bold: true, charSpacing: 3 });
  if (title)
    s.addText(title, { x: MX, y: 0.72, w: W - 2 * MX, h: 0.8, fontFace: FONT, fontSize: titleSize, color: C.text, bold: true });
  s.addText([{ text: "NetChain", options: { color: C.text, bold: true } }, { text: "  deep dive", options: { color: C.faint } }],
    { x: MX, y: H - 0.45, w: 6, h: 0.3, fontFace: FONT, fontSize: 9 });
  s.addText("netchain.vercel.app", { x: W - MX - 3, y: H - 0.45, w: 3, h: 0.3, align: "right", fontFace: FONT, fontSize: 9, color: C.faint });
  return s;
}
function card(s, x, y, w, h, fill = C.card) {
  s.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.09, fill: { color: fill }, line: { color: C.cardEdge, width: 1 } });
}
function bullets(s, items, x, y, w, opts = {}) {
  s.addText(items.map((t) => ({ text: t, options: { bullet: { code: "2022", indent: 16 }, color: opts.color || C.text, breakLine: true } })),
    { x, y, w, h: opts.h || 3.2, fontFace: FONT, fontSize: opts.fontSize || 14, color: C.text, lineSpacingMultiple: 1.2, valign: "top", paraSpaceAfter: 8 });
}
// framed screenshot; w in inches, height derived from aspect.
function shot(s, file, x, y, w, caption) {
  const h = w * IMG_AR;
  s.addImage({ path: `screens/${file}`, x, y, w, h });
  s.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.03, fill: { type: "none" }, line: { color: C.cardEdge, width: 1 } });
  if (caption) s.addText(caption, { x, y: y + h + 0.05, w, h: 0.3, align: "center", fontFace: FONT, fontSize: 10, italic: true, color: C.faint });
  return h;
}
// diagram node
function node(s, x, y, w, h, label, col = C.accent, sub) {
  s.addShape(pptx.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.08, fill: { color: C.card }, line: { color: col, width: 1.5 } });
  s.addText(sub ? [{ text: label, options: { bold: true, color: C.text, fontSize: 13, breakLine: true } }, { text: sub, options: { color: C.muted, fontSize: 10 } }]
    : label, { x: x + 0.1, y, w: w - 0.2, h, align: "center", valign: "middle", fontFace: FONT, fontSize: 13, bold: true, color: C.text });
}
// arrow from (x1,y1) to (x2,y2). Normalize to a non-negative bounding box with
// flipH/flipV, negative w/h (right-to-left / bottom-to-top) is invalid OOXML
// geometry and makes PowerPoint refuse the whole file.
function arrow(s, x1, y1, x2, y2, col = C.faint) {
  s.addShape(pptx.ShapeType.line, {
    x: Math.min(x1, x2), y: Math.min(y1, y2),
    w: Math.abs(x2 - x1), h: Math.abs(y2 - y1),
    flipH: x2 < x1, flipV: y2 < y1,
    line: { color: col, width: 1.75, endArrowType: "triangle" },
  });
}
function chip(s, x, y, w, text, col = C.green) {
  s.addShape(pptx.ShapeType.roundRect, { x, y, w, h: 0.34, rectRadius: 0.17, fill: { color: C.card }, line: { color: col, width: 1 } });
  s.addText(text, { x, y, w, h: 0.34, align: "center", valign: "middle", fontFace: FONT, fontSize: 10, color: col, bold: true });
}

/* ---------- 1. Title ----------------------------------------------------- */
{
  const s = pptx.addSlide();
  s.background = { color: C.bg };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.06, fill: { color: C.accent } });
  s.addText("NetChain", { x: MX, y: 2.0, w: W - 2 * MX, h: 1.2, fontFace: FONT, fontSize: 60, bold: true, color: C.white });
  s.addText("A deep dive into the platform and how it works", { x: MX, y: 3.25, w: 11, h: 0.6, fontFace: FONT, fontSize: 22, color: C.text });
  s.addText("Confidential multilateral netting with atomic settlement on Canton. AI proposes, the ledger disposes.",
    { x: MX, y: 3.95, w: 11.5, h: 0.6, fontFace: FONT, fontSize: 15, italic: true, color: C.accent });
  s.addText([{ text: "Live on Canton Devnet  ·  ", options: { color: C.faint } }, { text: "netchain.vercel.app", options: { color: C.green } },
    { text: "  ·  every screen in this deck is a real screenshot of the live app", options: { color: C.faint } }],
    { x: MX, y: 6.2, w: 12, h: 0.4, fontFace: FONT, fontSize: 12 });
}

/* ---------- 2. What it is ------------------------------------------------ */
{
  const s = slide({ kicker: "In one screen", title: "What NetChain does" });
  shot(s, "shot-dashboard.png", MX, 1.7, 7.0, "The live dashboard, LIVE badge = reads come straight from the Canton validator");
  card(s, 8.1, 1.7, 4.53, 4.4);
  bullets(s, [
    "Companies that owe each other net down to one payment each, then settle.",
    "The catch everywhere else: to net, someone sees the whole web of who-owes-whom.",
    "NetChain keeps counterparties blind to each other AND settles every net leg atomically, in one Canton transaction.",
    "An on-ledger policy bounds it, so even an AI agent driving it cannot overspend.",
  ], 8.35, 2.0, 4.0, { fontSize: 13.5, h: 4.0 });
}

/* ---------- 3. The cast -------------------------------------------------- */
{
  const s = slide({ kicker: "The cast", title: "One operator, three companies" });
  node(s, 5.5, 1.7, 2.3, 0.9, "Operator", C.amber, "netting bank / coordinator");
  node(s, 1.7, 3.6, 2.4, 0.9, "Company A", C.accent, "Aurora Manufacturing");
  node(s, 5.45, 3.6, 2.4, 0.9, "Company B", C.accent, "Borealis Logistics");
  node(s, 9.2, 3.6, 2.4, 0.9, "Company C", C.accent, "Cirrus Components");
  arrow(s, 6.65, 2.6, 2.9, 3.6, C.faint);
  arrow(s, 6.65, 2.6, 6.65, 3.6, C.faint);
  arrow(s, 6.65, 2.6, 10.4, 3.6, C.faint);
  bullets(s, [
    "The operator observes every obligation and runs the netting cycle. It is the one trusted, regulated coordinator, exactly the CLS / in-house-bank model.",
    "Each company sees ONLY its own slice of the ledger (per-party projection). A never sees B's dealings with C.",
    "In the demo all four are driven by one shared machine identity on the shared Devnet; per-user signing is the named next step.",
  ], MX, 5.0, W - 2 * MX, { fontSize: 13 });
}

/* ---------- 4. Architecture stack ---------------------------------------- */
{
  const s = slide({ kicker: "Architecture", title: "The stack, top to bottom" });
  const layers = [
    ["Browser  ·  Next.js 14 App Router + Zustand", "lib/ledger.ts client wrappers  (LIVE/mock switch, silent fallback)", C.accent],
    ["Server routes  ·  /api/ledger/[op]  +  /api/cron/net", "hold the M2M secret; the browser never touches a credential", C.accent],
    ["lib/ledger-server.ts", "builds JSON Ledger API commands, maps ledger ids <-> company-a/b/c", C.accent],
    ["JSON Ledger API v2  ·  5N Devnet validator", "/v2/commands, /v2/state/active-contracts, /v2/updates", C.green],
    ["Canton  ·  Daml package  (netchain, LF 2.3, PV35)", "Obligation · NettingCycle · TreasuryPolicy(+Proposal) · Account · NetPosition", C.green],
  ];
  let y = 1.65;
  layers.forEach(([t, sub, col], i) => {
    node(s, 2.4, y, 8.5, 0.82, "", col);
    s.addText([{ text: t, options: { bold: true, color: C.text, fontSize: 13, breakLine: true } }, { text: sub, options: { color: C.muted, fontSize: 10.5 } }],
      { x: 2.6, y, w: 8.1, h: 0.82, valign: "middle", fontFace: FONT });
    if (i < layers.length - 1) arrow(s, 6.65, y + 0.82, 6.65, y + 1.03, C.faint);
    y += 1.03;
  });
  s.addText("One request's path is the same every time: wrapper → route → ledger-server → validator → Daml, and back.",
    { x: MX, y: 6.55, w: W - 2 * MX, h: 0.3, align: "center", fontFace: FONT, fontSize: 12, color: C.faint, italic: true });
}

/* ---------- 5. Netting concept ------------------------------------------- */
{
  const s = slide({ kicker: "Core concept", title: "Multilateral netting: 460k gross collapses to 45k net" });
  shot(s, "shot-graph-gross.png", MX, 1.65, 6.0, "GROSS: 6 bilateral obligations, 460,000 USDCx");
  shot(s, "shot-graph-net.png", 6.95, 1.65, 6.0, "NET: one figure per party, sum = 0");
  card(s, MX, 5.5, W - 2 * MX, 1.15);
  s.addText([
    { text: "A owes B 120k, B owes C 95k, C owes A 150k, A owes C 40k, B owes A 25k, C owes B 30k   ", options: { color: C.muted, fontSize: 12 } },
    { text: "->   ", options: { color: C.faint, fontSize: 12 } },
    { text: "A +15k   B +30k   C -45k   (Σ = 0)", options: { color: C.green, fontSize: 13, bold: true } },
    { text: "\n90% less value has to actually move. The graph animates the collapse live (Gross <-> Net toggle).", options: { color: C.text, fontSize: 12 } },
  ], { x: MX + 0.3, y: 5.55, w: W - 2 * MX - 0.6, h: 1.05, valign: "middle", fontFace: FONT, lineSpacingMultiple: 1.15 });
}

/* ---------- 6. Atomic settlement ----------------------------------------- */
{
  const s = slide({ kicker: "Core concept", title: "Atomic settlement: all legs move, or none do" });
  shot(s, "shot-settlement.png", MX, 1.7, 6.6, "Settlement page: every net leg flips to Settled together, with a real tx id");
  card(s, 7.75, 1.7, 4.88, 4.5);
  bullets(s, [
    "Settle moves every party's balance inside ONE Canton transaction.",
    "Any failed assertion rolls back the WHOLE commit: no partial fills, no timing risk.",
    "An over-cap attempt aborts in-transaction and moves nothing, not by a cent, verifiable on the balances.",
    "This all-or-nothing DvP is the whole reason to settle on a ledger instead of over SWIFT.",
    "Funding is checked first; an underfunded party is dropped and the solvent remainder re-nets and settles.",
  ], 8.0, 2.0, 4.35, { fontSize: 13, h: 4.0 });
}

/* ---------- 7. Privacy --------------------------------------------------- */
{
  const s = slide({ kicker: "Core concept", title: "Per-party privacy is a ledger property, not a UI mask" });
  shot(s, "shot-privacy.png", MX, 1.7, 6.6, "Privacy Check: as Company C, an A<->B contract returns a real 404");
  card(s, 7.75, 1.7, 4.88, 4.5);
  s.addText("How it works", { x: 8.0, y: 1.95, w: 4.4, h: 0.35, fontFace: FONT, fontSize: 15, bold: true, color: C.accent });
  bullets(s, [
    "Canton projects each party only the sub-transactions it is a stakeholder in.",
    "Ask for a foreign contract as C: the validator returns HTTP 404, it will not even confirm it exists.",
    "Same id as Company A (a real stakeholder): resolves 200 with the amount.",
    "There is no `if (party != owner) hide()` in app code, the boundary is the node's.",
    "Impossible to fake with database access control, where a DB admin can always peek.",
  ], 8.0, 2.4, 4.35, { fontSize: 12.5, h: 3.6 });
}

/* ---------- 8. Obligations ----------------------------------------------- */
{
  const s = slide({ kicker: "Capability", title: "Obligations: from a raw invoice to an on-ledger contract" });
  shot(s, "shot-obligations.png", MX, 1.7, 7.0, "Obligations table, each row is a real Daml Obligation in this party's projection");
  card(s, 8.1, 1.7, 4.53, 4.5);
  bullets(s, [
    "Drop an invoice image: an AI agent (NVIDIA NIM vision) reads amount, counterparty, due date, reference.",
    "It proposes an on-ledger Obligation, stamped source = agent, with a UETR-style trace id.",
    "Manual entry is always right there as the always-works fallback.",
    "Signed by the obligor; observed only by the obligee and operator, so no third party sees it.",
  ], 8.35, 2.0, 4.0, { fontSize: 13, h: 4.0 });
}

/* ---------- 9. Bilateral confirmation ------------------------------------ */
{
  const s = slide({ kicker: "Trust safeguard", title: "Bilateral confirmation: a fake invoice can't settle" });
  shot(s, "shot-bilateral.png", MX, 1.7, 6.5, "As the obligee: 'Pending your acceptance' with an Accept button");
  // mini flow diagram
  const dy = 2.0;
  node(s, 7.7, dy, 4.8, 0.75, "1  Obligor records it", C.accent, "lands PENDING, excluded from netting");
  node(s, 7.7, dy + 1.15, 4.8, 0.75, "2  Obligee Accepts (on-ledger)", C.amber, "the second signature");
  node(s, 7.7, dy + 2.3, 4.8, 0.75, "3  Now it nets", C.green, "both parties have consented");
  arrow(s, 10.1, dy + 0.75, 10.1, dy + 1.15, C.faint);
  arrow(s, 10.1, dy + 1.9, 10.1, dy + 2.3, C.faint);
  s.addText("Enforced in the contract: ComputeNetPositions / Settle only count obligations where accepted = Some True. Neither a rogue party nor an AI agent can fabricate a debt that settles.",
    { x: 7.7, y: dy + 3.25, w: 4.9, h: 0.9, fontFace: FONT, fontSize: 11.5, color: C.text, lineSpacingMultiple: 1.15 });
}

/* ---------- 10. Policy + maker-checker ----------------------------------- */
{
  const s = slide({ kicker: "Governance", title: "TreasuryPolicy cap + maker-checker cap changes" });
  shot(s, "shot-policy.png", MX, 1.7, 6.2, "Policy page: the enforced cap + the maker-checker governance panel");
  card(s, 7.35, 1.7, 5.28, 4.5);
  s.addText("The cap the ledger enforces", { x: 7.6, y: 1.95, w: 4.8, h: 0.35, fontFace: FONT, fontSize: 14, bold: true, color: C.accent });
  bullets(s, [
    "maxSettlementPerCycle is asserted INSIDE the Settle transaction, not in the UI.",
    "Over-cap settle is refused on-ledger; no override flag exists for an agent to set.",
  ], 7.6, 2.35, 4.75, { fontSize: 12, h: 1.3 });
  s.addText("Changing a cap: four-eyes", { x: 7.6, y: 3.75, w: 4.8, h: 0.35, fontFace: FONT, fontSize: 14, bold: true, color: C.amber });
  bullets(s, [
    "Party proposes a new cap (maker); operator approves (checker). Neither acts alone.",
    "The operator still cannot unilaterally RAISE a cap, only approve what the party proposed.",
    "The SOX / Basel / treasury segregation-of-duties standard, modeled on-ledger.",
  ], 7.6, 4.15, 4.75, { fontSize: 12, h: 2.0 });
}

/* ---------- 11. Automated netting ---------------------------------------- */
{
  const s = slide({ kicker: "Automation", title: "Netting runs itself, on a schedule" });
  node(s, 0.9, 2.55, 2.5, 1.0, "Vercel Cron", C.accent, "free daily, or an agent");
  node(s, 4.0, 2.55, 2.6, 1.0, "/api/cron/net", C.accent, "CRON_SECRET-gated");
  node(s, 7.2, 2.55, 2.6, 1.0, "Funding check\n+ Settle", C.green, "policy-bounded");
  node(s, 10.4, 2.55, 2.2, 1.0, "Self-heal", C.amber, "reseed to clean");
  arrow(s, 3.4, 3.05, 4.0, 3.05); arrow(s, 6.6, 3.05, 7.2, 3.05); arrow(s, 9.8, 3.05, 10.4, 3.05);
  bullets(s, [
    "The operator does not have to click every time: a scheduled job runs the whole cycle and settles.",
    "Automating the trigger changes nothing about correctness, the cap and funding checks are enforced on-ledger regardless of who fires it.",
    "Scheduled batch windows are also the industry-correct model (CLS / CHIPS run daily cutoffs); netting compresses more with batching.",
    "After each run it self-heals the public demo back to the clean open state, so it is always ready to show.",
  ], MX, 4.3, W - 2 * MX, { fontSize: 13 });
}

/* ---------- 12. Agentic / MCP -------------------------------------------- */
{
  const s = slide({ kicker: "Agentic (Track 3)", title: "An AI agent drives it, bounded by the ledger" });
  node(s, 1.1, 2.5, 2.6, 1.0, "AI agent", C.accent, "Claude or any MCP client");
  node(s, 4.4, 2.5, 3.0, 1.0, "NetChain MCP", C.accent, "16 tools, thin pass-through");
  node(s, 8.1, 2.5, 2.4, 1.0, "HTTP API", C.accent, "same routes as UI");
  node(s, 10.9, 2.5, 1.7, 1.0, "Canton", C.green, "the ledger decides");
  arrow(s, 3.7, 3.0, 4.4, 3.0); arrow(s, 7.4, 3.0, 8.1, 3.0); arrow(s, 10.5, 3.0, 10.9, 3.0);
  // enforcement happens at the ledger, so anchor the chip under Canton (box 4).
  arrow(s, 11.75, 3.9, 11.75, 3.55, C.red);
  chip(s, 8.7, 3.95, 3.4, "TreasuryPolicy blocks over-cap", C.red);
  bullets(s, [
    "The agent can propose any obligation, cycle, or settlement, list/create/accept/net/settle, propose or approve caps.",
    "It CANNOT make the ledger accept an over-cap settle, raise its own cap, or self-approve a debt: those live in the Daml, not the prompt.",
    "'AI proposes, the ledger disposes.' A concrete answer to agent authority without an unbounded blast radius.",
  ], MX, 4.5, W - 2 * MX, { fontSize: 13 });
}

/* ---------- 13. Verification --------------------------------------------- */
{
  const s = slide({ kicker: "Proof", title: "Every settlement is a verifiable on-ledger fact" });
  card(s, MX, 1.8, 5.6, 4.2);
  s.addText("updateId = the ledger receipt", { x: MX + 0.3, y: 2.1, w: 5.0, h: 0.4, fontFace: FONT, fontSize: 15, bold: true, color: C.accent });
  bullets(s, [
    "Settle returns a real updateId from the validator's submit-and-wait, not a client-side hash.",
    "'Re-verify live' re-fetches that exact id via /v2/updates/update-by-id: confirmed = true + effectiveAt.",
    "A bogus/forged id returns confirmed = false.",
    "No public explorer can show it, sub-transaction contents are private by design; the operator-scoped verify IS the explorer.",
  ], MX + 0.3, 2.55, 5.0, { fontSize: 12.5, h: 3.2 });
  card(s, 6.6, 1.8, 6.03, 4.2, "0E1620");
  s.addText([
    { text: "GET /api/ledger/verify?updateId=1220ab1b…\n", options: { color: C.green } },
    { text: "{\n  \"confirmed\": true,\n  \"effectiveAt\": \"2026-07-12T07:29:51Z\",\n  \"validator\":\n    \"ledger-api.validator.devnet…fivenorth.io\"\n}", options: { color: C.text } },
  ], { x: 6.85, y: 2.1, w: 5.5, h: 3.6, fontFace: MONO, fontSize: 12, valign: "top", lineSpacingMultiple: 1.25 });
}

/* ---------- 14. SCU chain ------------------------------------------------ */
{
  const s = slide({ kicker: "Live on Canton", title: "Shipped as live Smart Contract Upgrades, no downtime" });
  const items = [
    ["v1.0.0", "netting + atomic settle + privacy", C.accent],
    ["v1.0.1", "settle-correctness fix", C.accent],
    ["v1.0.2", "provenance + UETR trace", C.accent],
    ["v1.0.3", "bilateral confirmation", C.green],
    ["v1.0.4", "maker-checker cap governance", C.green],
  ];
  const cw = 2.15, gap = 0.28, y = 2.9;
  items.forEach(([v, d, col], i) => {
    const x = MX + i * (cw + gap);
    node(s, x, y, cw, 1.4, "", col);
    s.addText([{ text: v, options: { bold: true, color: col, fontSize: 16, breakLine: true } }, { text: "\n" + d, options: { color: C.muted, fontSize: 10.5 } }],
      { x: x + 0.12, y, w: cw - 0.24, h: 1.4, align: "center", valign: "middle", fontFace: FONT });
    if (i < items.length - 1) arrow(s, x + cw, y + 0.7, x + cw + gap, y + 0.7, C.faint);
  });
  s.addText("Adding Optional fields, choices, and whole templates as valid upgrades, the running demo was never taken down. Each step is reversible by pointing the app back at the prior package id.",
    { x: MX, y: 4.85, w: W - 2 * MX, h: 0.8, align: "center", fontFace: FONT, fontSize: 13, color: C.text, lineSpacingMultiple: 1.2 });
  s.addText("current: netchain v1.0.4  ·  8ae58d7ccd979213f10c78a328da0f7edfa3614060a4cf7250216837a7768cbb",
    { x: MX, y: 5.95, w: W - 2 * MX, h: 0.3, align: "center", fontFace: MONO, fontSize: 10.5, color: C.muted });
}

/* ---------- 15. Audit ---------------------------------------------------- */
{
  const s = slide({ kicker: "Capability", title: "Audit trail + regulator-ready exports" });
  shot(s, "shot-audit.png", MX, 1.7, 7.0, "Audit page: gross obligations, net positions, and settled legs, all from the ledger");
  card(s, 8.1, 1.7, 4.53, 4.5);
  bullets(s, [
    "The full chronological activity feed comes from real on-chain transaction history (/v2/updates).",
    "Net positions are recovered from history, so the audit view survives Settle archiving them.",
    "Export settled legs as CSV and as ISO 20022 pain.001 (one PmtInf per debtor), the format banks already ingest.",
    "This is the reconciliation surface a treasury/SSC team lives in.",
  ], 8.35, 2.0, 4.0, { fontSize: 12.5, h: 4.0 });
}

/* ---------- 16. Privacy model honesty ------------------------------------ */
{
  const s = slide({ kicker: "Honest framing", title: "\"If the operator sees the graph, what's private?\"" });
  bullets(s, [
    "Counterparty privacy is the guarantee, and the valuable kind: A and C never see each other (the live 404). That is what a treasurer needs, your positions never leak to a competitor.",
    "The operator is a trusted, regulated intermediary, the same model as CLS and every netting center today, not an eavesdropper.",
    "That already beats incumbents (Kyriba / SAP), a ledger boundary instead of database access control.",
    "Removing even operator visibility (operator-blind netting via MPC / ZK) is named as roadmap, honestly, in docs/SETTLEMENT_DESIGN.md, not faked.",
  ], MX, 2.1, W - 2 * MX, { fontSize: 15, h: 3.6 });
  chip(s, MX, 5.6, 4.7, "Lead with the true claim, not overclaim", C.amber);
}

/* ---------- 17. Positioning ---------------------------------------------- */
{
  const s = slide({ kicker: "Where it sits", title: "The intersection nobody else occupies" });
  card(s, MX, 1.8, 5.75, 3.0);
  s.addText("Netting incumbents", { x: MX + 0.3, y: 2.05, w: 5, h: 0.4, fontFace: FONT, fontSize: 15, bold: true, color: C.muted });
  bullets(s, ["Kyriba, Coprocess/GTreasury, SAP In-House Cash.", "Compute the net, then hand off to non-atomic bank rails.", "No cryptographic per-party privacy."], MX + 0.3, 2.5, 5.15, { fontSize: 12.5, h: 2.1 });
  card(s, 6.85, 1.8, 5.78, 3.0);
  s.addText("DLT settlement players", { x: 7.15, y: 2.05, w: 5, h: 0.4, fontFace: FONT, fontSize: 15, bold: true, color: C.muted });
  bullets(s, ["Partior, Fnality, J.P. Morgan Kinexys.", "Settle atomically, but only bilaterally.", "No confidential N-party net computation."], 7.15, 2.5, 5.15, { fontSize: 12.5, h: 2.1 });
  card(s, MX, 5.0, W - 2 * MX, 1.5, "10251C");
  s.addText([{ text: "NetChain sits at both: ", options: { bold: true, color: C.green, fontSize: 15 } },
    { text: "confidential N-party netting + atomic settlement of every net leg, on Canton. J.P. Morgan bringing JPMD to Canton and Ripple/GTreasury fusing netting with a rail are independent 2026 validation that this combination is real and not yet commoditized.", options: { color: C.text, fontSize: 13 } }],
    { x: MX + 0.3, y: 5.15, w: W - 2 * MX - 0.6, h: 1.2, valign: "middle", fontFace: FONT, lineSpacingMultiple: 1.2 });
}

/* ---------- 18. Capability recap ----------------------------------------- */
{
  const s = slide({ kicker: "Recap", title: "Everything, on one slide" });
  const caps = [
    ["Confidential netting", "460k -> 45k, counterparties blind"],
    ["Atomic settlement", "all legs or none, one commit"],
    ["Per-party privacy", "real 404, ledger-enforced"],
    ["Bilateral confirmation", "obligee accepts, anti-fake-invoice"],
    ["Non-bypassable policy", "cap asserted in Settle"],
    ["Maker-checker caps", "four-eyes governance"],
    ["Automated netting", "scheduled, self-healing"],
    ["Agent-usable (MCP)", "16 tools, ledger-bounded"],
    ["Verifiable + upgradable", "real updateIds, live SCU chain"],
  ];
  const cw = 3.9, ch = 1.2, gx = 0.25, gy = 0.3, x0 = MX, y0 = 2.15;
  caps.forEach((c, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = x0 + col * (cw + gx), y = y0 + row * (ch + gy);
    card(s, x, y, cw, ch);
    s.addText([{ text: c[0] + "\n", options: { bold: true, color: C.accent, fontSize: 14 } }, { text: c[1], options: { color: C.muted, fontSize: 11 } }],
      { x: x + 0.2, y, w: cw - 0.4, h: ch, valign: "middle", fontFace: FONT, lineSpacingMultiple: 1.1 });
  });
}

/* ---------- 19. Close ---------------------------------------------------- */
{
  const s = pptx.addSlide();
  s.background = { color: C.bg };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.06, fill: { color: C.accent } });
  s.addText("Settle everything, reveal nothing.", { x: MX, y: 2.6, w: W - 2 * MX, h: 1.0, fontFace: FONT, fontSize: 38, bold: true, color: C.white });
  s.addText("Confidential netting · atomic settlement · bilateral consent · maker-checker limits · a policy the ledger enforces · an agent that can't overstep it.",
    { x: MX, y: 3.8, w: 11.7, h: 0.7, fontFace: FONT, fontSize: 15, color: C.muted });
  s.addText([{ text: "Try it:  ", options: { color: C.faint } }, { text: "netchain.vercel.app", options: { color: C.green, bold: true } },
    { text: "     Repo:  ", options: { color: C.faint } }, { text: "github.com/manjeetsharma0796/Net-chain", options: { color: C.accent } }],
    { x: MX, y: 5.4, w: 12, h: 0.4, fontFace: FONT, fontSize: 14 });
  s.addText("Live on Canton Devnet · package netchain v1.0.4 · every screen here is the real running app.",
    { x: MX, y: 5.95, w: 12, h: 0.4, fontFace: FONT, fontSize: 12, color: C.faint });
}

await pptx.writeFile({ fileName: "NetChain-DeepDive.pptx" });
console.log("wrote NetChain-DeepDive.pptx (" + pptx.slides.length + " slides)");
