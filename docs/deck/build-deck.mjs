// NetChain hackathon pitch deck generator (pptxgenjs).
// Built per the anthropics `pptx` skill's "create from scratch" path.
// Run: node build-deck.mjs  ->  NetChain-Pitch.pptx
import pptxgen from "pptxgenjs";

const C = {
  bg: "0B0F14",
  card: "141C25",
  cardEdge: "223040",
  text: "E6EDF3",
  muted: "8FA6B8",
  faint: "5F7486",
  accent: "7FA6C9",
  green: "38E1A4",
  amber: "F5C451",
  white: "FFFFFF",
};
const FONT = "Segoe UI";
const FONT_L = "Segoe UI Light";

const pptx = new pptxgen();
pptx.defineLayout({ name: "W", width: 13.333, height: 7.5 });
pptx.layout = "W";
pptx.author = "NetChain";
pptx.title = "NetChain, pitch";

const W = 13.333, H = 7.5, MX = 0.7;

// A slide with the standard chrome: dark bg, accent kicker, title, footer.
function slide({ kicker, title, titleSize = 30, titleColor = C.text }) {
  const s = pptx.addSlide();
  s.background = { color: C.bg };
  // top accent bar
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.06, fill: { color: C.accent } });
  if (kicker)
    s.addText(kicker.toUpperCase(), {
      x: MX, y: 0.5, w: W - 2 * MX, h: 0.3,
      fontFace: FONT, fontSize: 11, color: C.accent, bold: true, charSpacing: 3,
    });
  if (title)
    s.addText(title, {
      x: MX, y: 0.82, w: W - 2 * MX, h: 0.9,
      fontFace: FONT, fontSize: titleSize, color: titleColor, bold: true,
    });
  // footer
  s.addText(
    [
      { text: "NetChain", options: { color: C.text, bold: true } },
      { text: "   Confidential netting + atomic settlement on Canton", options: { color: C.faint } },
    ],
    { x: MX, y: H - 0.5, w: 9, h: 0.3, fontFace: FONT, fontSize: 9 },
  );
  s.addText("netchain.vercel.app", {
    x: W - MX - 3, y: H - 0.5, w: 3, h: 0.3, align: "right",
    fontFace: FONT, fontSize: 9, color: C.faint,
  });
  return s;
}

// A rounded card.
function card(s, x, y, w, h, fill = C.card) {
  s.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.1,
    fill: { color: fill }, line: { color: C.cardEdge, width: 1 },
  });
}

// bullet list helper
function bullets(s, items, x, y, w, opts = {}) {
  s.addText(
    items.map((t) => ({
      text: t,
      options: { bullet: { code: "2022", indent: 18 }, color: opts.color || C.text, breakLine: true },
    })),
    {
      x, y, w, h: opts.h || 3.5,
      fontFace: FONT, fontSize: opts.fontSize || 16, color: C.text,
      lineSpacingMultiple: 1.25, valign: "top", paraSpaceAfter: 10,
    },
  );
}

/* ---- 1. Title ---------------------------------------------------------- */
{
  const s = pptx.addSlide();
  s.background = { color: C.bg };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.06, fill: { color: C.accent } });
  s.addText("NetChain", {
    x: MX, y: 2.2, w: W - 2 * MX, h: 1.4, fontFace: FONT, fontSize: 66, bold: true, color: C.white,
  });
  s.addText("Confidential multilateral netting with atomic settlement on Canton.", {
    x: MX, y: 3.6, w: 11, h: 0.6, fontFace: FONT, fontSize: 22, color: C.text,
  });
  s.addText("AI proposes, the ledger disposes.", {
    x: MX, y: 4.25, w: 11, h: 0.5, fontFace: FONT, fontSize: 18, italic: true, color: C.accent,
  });
  s.addText(
    [
      { text: "Build on Canton Hackathon", options: { color: C.muted } },
      { text: "   ·   Live on Canton Devnet   ·   ", options: { color: C.faint } },
      { text: "netchain.vercel.app", options: { color: C.green } },
    ],
    { x: MX, y: 6.3, w: 11, h: 0.4, fontFace: FONT, fontSize: 13 },
  );
}

/* ---- 2. Problem -------------------------------------------------------- */
{
  const s = slide({ kicker: "The problem", title: "Netting leaks, and settlement doesn't finalize" });
  card(s, MX, 2.0, 5.75, 3.9);
  card(s, 6.85, 2.0, 5.75, 3.9);
  s.addText("Everyone sees everyone", { x: MX + 0.35, y: 2.3, w: 5, h: 0.5, fontFace: FONT, fontSize: 19, bold: true, color: C.amber });
  bullets(s, [
    "To net multilaterally, a coordinator sees the full web of who owes whom.",
    "Your exposures, volumes, and counterparties leak to competitors in the same net.",
    "Incumbents (Kyriba, SAP In-House Cash) rely on access control, a DB admin can still peek.",
  ], MX + 0.35, 3.0, 5.1, { fontSize: 14 });
  s.addText("Then it hands off to slow rails", { x: 6.85 + 0.35, y: 2.3, w: 5, h: 0.5, fontFace: FONT, fontSize: 19, bold: true, color: C.amber });
  bullets(s, [
    "Netting engines compute a figure, then export an instruction file.",
    "Actual settlement happens later, over conventional bank rails, non-atomically.",
    "That gap is settlement risk: some legs can move while others fail.",
  ], 6.85 + 0.35, 3.0, 5.1, { fontSize: 14 });
}

/* ---- 3. Thesis --------------------------------------------------------- */
{
  const s = slide({ kicker: "The thesis", title: "The intersection nobody else occupies" });
  bullets(s, [
    "Confidential N-party netting: the operator sees the graph, counterparties stay blind to each other.",
    "Atomic, all-or-nothing settlement of every net leg inside ONE ledger transaction.",
    "Both, on Canton. Netting incumbents do the first and hand off; DLT settlement players do the second, only bilaterally.",
  ], MX, 2.1, 7.4, { fontSize: 17, h: 2.6 });
  card(s, 8.6, 2.0, 4.03, 3.9, C.card);
  s.addText("No researched competitor", { x: 8.85, y: 2.25, w: 3.6, h: 0.4, fontFace: FONT, fontSize: 14, color: C.muted });
  s.addText("sits at BOTH", { x: 8.85, y: 2.62, w: 3.6, h: 0.6, fontFace: FONT, fontSize: 26, bold: true, color: C.green });
  s.addText(
    [
      { text: "Confidential netting", options: { color: C.text, breakLine: true, bullet: { code: "2713", indent: 16 } } },
      { text: "Atomic settlement", options: { color: C.text, breakLine: true, bullet: { code: "2713", indent: 16 } } },
      { text: "Per-party privacy", options: { color: C.text, breakLine: true, bullet: { code: "2713", indent: 16 } } },
      { text: "Agent-safe by policy", options: { color: C.text, bullet: { code: "2713", indent: 16 } } },
    ],
    { x: 8.85, y: 3.5, w: 3.5, h: 2.2, fontFace: FONT, fontSize: 15, color: C.green, lineSpacingMultiple: 1.3 },
  );
}

/* ---- 4. How it works --------------------------------------------------- */
{
  const s = slide({ kicker: "How it works", title: "Gross obligations collapse to net, then settle atomically" });
  const steps = [
    ["1  Obligations", "Each company records what it owes, on-ledger.", C.accent],
    ["2  Netting cycle", "Gross 460k collapses to net 45k.  Σ nets = 0.", C.accent],
    ["3  Atomic settle", "Every net leg moves in one commit, or none do.", C.green],
  ];
  const cw = 3.7, gap = 0.55, y = 2.6, h = 2.7;
  steps.forEach(([t, d, col], i) => {
    const x = MX + i * (cw + gap);
    card(s, x, y, cw, h);
    s.addText(t, { x: x + 0.3, y: y + 0.35, w: cw - 0.6, h: 0.6, fontFace: FONT, fontSize: 18, bold: true, color: col });
    s.addText(d, { x: x + 0.3, y: y + 1.15, w: cw - 0.6, h: 1.3, fontFace: FONT, fontSize: 14, color: C.text, valign: "top" });
    if (i < 2) s.addText("→", { x: x + cw + 0.05, y: y + h / 2 - 0.35, w: 0.45, h: 0.7, align: "center", fontFace: FONT, fontSize: 26, color: C.faint });
  });
  s.addText("A=+15k   B=+30k   C=-45k   (sum zero, gross collapses to a smaller net)", {
    x: MX, y: 5.6, w: 11.9, h: 0.4, align: "center", fontFace: FONT, fontSize: 13, color: C.muted,
  });
}

/* ---- money moments 5-8 ------------------------------------------------- */
function moment({ n, kicker, title, color, left, proof }) {
  const s = slide({ kicker: `Money moment ${n} · ${kicker}`, title });
  bullets(s, left, MX, 2.15, 7.2, { fontSize: 16, h: 3.4 });
  card(s, 8.35, 2.1, 4.28, 3.9, C.card);
  s.addText("VERIFY IT'S REAL", { x: 8.6, y: 2.35, w: 3.8, h: 0.3, fontFace: FONT, fontSize: 10, bold: true, charSpacing: 2, color: color });
  s.addText(proof, { x: 8.6, y: 2.75, w: 3.8, h: 3.0, fontFace: "Consolas", fontSize: 11.5, color: C.text, valign: "top", lineSpacingMultiple: 1.2 });
  return s;
}

moment({
  n: 1, kicker: "Privacy", color: C.accent,
  title: "Real per-party privacy, a live 404",
  left: [
    "As Company C, ask the ledger for an A→B contract by its exact id: HTTP 404, contract not found.",
    "As Company A, the same id resolves 200 with the real amount.",
    "The node will not even confirm the contract exists to a non-stakeholder. No app-side masking.",
    "Canton projects each party only the sub-transactions it is party to.",
  ],
  proof: "as C:\n  GET /contract?party=company-c\n  → 404 CONTRACT_NOT_FOUND\n\nas A:\n  GET /contract?party=company-a\n  → 200  { amount: ... }",
});

moment({
  n: 2, kicker: "Atomic DvP", color: C.green,
  title: "Atomic settlement, zero-movement abort then clean settle",
  left: [
    "First, a settle that breaks a policy cap: it aborts inside the Canton transaction.",
    "Balances do not move, not by a cent. No partial fills, no timing risk.",
    "Then the clean run: every net leg settles in one commit, one tx id on the ledger.",
    "All-or-nothing DvP is the whole reason to settle on a ledger, not over SWIFT.",
  ],
  proof: "over-cap settle\n  → rejected in-transaction\n  balances unchanged\n\nunder-cap settle\n  → one commit, one updateId\n  A +15k  B +30k  C -45k",
});

moment({
  n: 3, kicker: "Bilateral consent", color: C.amber,
  title: "Bilateral confirmation, the fake-invoice safeguard",
  left: [
    "A new obligation lands PENDING and is excluded from netting.",
    "It only counts once the obligee confirms it on-ledger, the Accept choice, controlled by the obligee.",
    "So a fabricated invoice cannot settle on one party's say-so. Both signatures, enforced by the contract.",
    "Shipped as a live Smart Contract Upgrade to v1.0.3.",
  ],
  proof: "create obligation\n  → accepted: false (pending)\n  excluded from the net\n\nobligee Accept\n  → accepted: true\n  now it nets",
});

moment({
  n: 4, kicker: "Agentic", color: C.accent,
  title: "An AI agent drives it, and gets policy-blocked",
  left: [
    "An agent calls NetChain's tools over our MCP server: record, net, settle.",
    "It tries to settle above a party's cap, and is blocked, not by a prompt guardrail, by the on-ledger TreasuryPolicy.",
    "Bounded authority: hand the agent the tools, keep the limit somewhere the agent cannot reach, the ledger.",
    "12 MCP tools, including accept_obligation, so agents honor bilateral consent.",
  ],
  proof: "agent: settle (over cap)\n  → ledger rejects\n  0 funds move\n\nthe cap lives in the Daml\nSettle choice, not in the\nMCP server or the prompt.",
});

/* ---- 9. Privacy model honestly ---------------------------------------- */
{
  const s = slide({ kicker: "Privacy model, honestly", title: "“If the operator sees the graph, what's private?”" });
  bullets(s, [
    "Counterparty privacy is the guarantee, and the valuable kind: A and C never see each other (the live 404).",
    "The operator is a trusted, regulated intermediary, the same model as CLS and every netting center today.",
    "That already beats incumbents: a ledger boundary, not database access control a DB admin can bypass.",
    "Removing even operator visibility (operator-blind netting via MPC / ZK) is named as roadmap, honestly, not faked.",
  ], MX, 2.2, 11.9, { fontSize: 17, h: 3.6 });
}

/* ---- 10. Proof it's real ---------------------------------------------- */
{
  const s = slide({ kicker: "Proof it is real", title: "Running live on Canton Devnet, upgraded without downtime" });
  const items = [
    ["Live on 5N Devnet", "Canton Protocol Version 35. Every claim in the demo is a real validator response, cross-checkable with curl."],
    ["Smart Contract Upgrades", "v1.0.0 → v1.0.3 as live SCUs, no downtime, including today's bilateral confirmation."],
    ["Verifiable transactions", "Every settle returns a real updateId; a verify endpoint re-fetches it from the validator."],
  ];
  const cw = 3.7, gap = 0.55, y = 2.3, h = 3.4;
  items.forEach(([t, d], i) => {
    const x = MX + i * (cw + gap);
    card(s, x, y, cw, h);
    s.addText(t, { x: x + 0.3, y: y + 0.35, w: cw - 0.6, h: 0.8, fontFace: FONT, fontSize: 17, bold: true, color: C.accent, valign: "top" });
    s.addText(d, { x: x + 0.3, y: y + 1.35, w: cw - 0.6, h: 1.8, fontFace: FONT, fontSize: 13.5, color: C.text, valign: "top" });
  });
  s.addText("pkg v1.0.3  219a350c…61eed0", { x: MX, y: 6.0, w: 11.9, h: 0.35, align: "center", fontFace: "Consolas", fontSize: 12, color: C.muted });
}

/* ---- 11. Market -------------------------------------------------------- */
{
  const s = slide({ kicker: "Market", title: "The buyer, the gap, and the 2026 validation" });
  card(s, MX, 2.0, 5.75, 3.9);
  s.addText("Who buys it", { x: MX + 0.35, y: 2.3, w: 5, h: 0.4, fontFace: FONT, fontSize: 17, bold: true, color: C.accent });
  bullets(s, [
    "Corporate treasury + shared-service centers running an in-house-bank / netting-center model.",
    "Same buyer as Kyriba, Coprocess/GTreasury, SAP In-House Cash.",
    "Incumbents net-only-then-hand-off, or settle-atomically-but-only-bilaterally. Neither does both.",
  ], MX + 0.35, 2.85, 5.1, { fontSize: 13.5 });
  card(s, 6.85, 2.0, 5.75, 3.9);
  s.addText("Why now (2026)", { x: 6.85 + 0.35, y: 2.3, w: 5, h: 0.4, fontFace: FONT, fontSize: 17, bold: true, color: C.green });
  bullets(s, [
    "J.P. Morgan brought JPMD natively to Canton, explicitly for privacy its own rails lack.",
    "Ripple / GTreasury shipped a TMS fusing netting with a digital-asset rail (no privacy or atomic net claim).",
    "Independent validation that this exact combination is real and not-yet-commoditized.",
  ], 6.85 + 0.35, 2.85, 5.1, { fontSize: 13.5 });
}

/* ---- 12. Close --------------------------------------------------------- */
{
  const s = pptx.addSlide();
  s.background = { color: C.bg };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.06, fill: { color: C.accent } });
  s.addText("Settle everything, reveal nothing.", {
    x: MX, y: 2.6, w: W - 2 * MX, h: 1.0, fontFace: FONT, fontSize: 40, bold: true, color: C.white,
  });
  s.addText("Confidential netting · atomic settlement · bilateral consent · a policy the ledger enforces · an agent that can't overstep it.", {
    x: MX, y: 3.75, w: 11.5, h: 0.7, fontFace: FONT, fontSize: 16, color: C.muted,
  });
  s.addText(
    [
      { text: "Try it:  ", options: { color: C.faint } },
      { text: "netchain.vercel.app", options: { color: C.green, bold: true } },
      { text: "     Repo:  ", options: { color: C.faint } },
      { text: "github.com/manjeetsharma0796/Net-chain", options: { color: C.accent } },
    ],
    { x: MX, y: 5.5, w: 11.9, h: 0.4, fontFace: FONT, fontSize: 14 },
  );
  s.addText("Agent-usable via the NetChain MCP server (12 tools, bounded by on-ledger policy).", {
    x: MX, y: 6.0, w: 11.9, h: 0.4, fontFace: FONT, fontSize: 12, color: C.faint,
  });
}

await pptx.writeFile({ fileName: "NetChain-Pitch.pptx" });
console.log("wrote NetChain-Pitch.pptx (" + pptx.slides.length + " slides)");
