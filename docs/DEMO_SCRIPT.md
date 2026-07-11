# NetChain, 3-Minute Demo Script

For the Build on Canton Hackathon submission video (Encode Club + Canton Foundation).
Target: 3:00 with a live demo. Panel is Canton Foundation plus crypto VCs who reward one thing,
"could this be real in production tomorrow?" So every beat shows the ledger enforcing the claim,
not a UI pretending to.

**Thesis, say it once, up front:** NetChain is confidential multilateral netting with atomic
settlement on Canton. AI proposes, the ledger disposes.

**Setup before recording:** live mode on (`NEXT_PUBLIC_LEDGER_LIVE=1`), the clean seeded cycle
loaded (A/B/C, 6 obligations, gross 460k, net +15k / +30k / -45k), party switcher visible in the
top bar, and a terminal or agent console ready for the MCP beat. Keep the ledger tx ids on screen
whenever one appears, they are the proof.

---

## Beat 0, Hook and thesis (0:00 to 0:18)

**On screen:** Title slide, then the live dashboard with the party switcher.

**Narration:**
"Companies that owe each other money net it down before they settle. The problem: everyone in the
net sees everyone else's exposure. NetChain fixes that. Confidential multilateral netting with
atomic settlement on Canton. AI proposes, the ledger disposes. This is running live on Canton
Devnet right now, so let me show you, not tell you."

---

## Money moment 1, Real per-party 404 privacy (0:18 to 0:52)

**On screen:** Log in as **Company C**. Open `/app/privacy-check`. Paste the exact contract id of an
A to B obligation and hit "Fetch foreign contract". It returns `CONTRACT_NOT_FOUND`. Then flip the
party switcher to **Company A** and fetch the same id, it resolves 200 with the real amount.

**Narration:**
"I'm Company C. I have the exact id of a contract between A and B, and I ask the ledger for it.
Watch: 404, contract not found. The node will not even admit it exists. Now I switch to Company A,
same id, and it resolves. This isn't a hidden field in the UI. Canton projects each party only the
sub-transactions it's a stakeholder in. Privacy is a ledger property here, not an app promise."

**Why judges care:** unscripted, live, and impossible to fake with access control on a normal DB.

---

## Money moment 2, Atomic settlement, over-cap abort then clean settle (0:52 to 1:32)

**On screen:** Go to `/app/settlement`. Show the three balances first (A 115k, B 130k, C 55k).
Attempt to settle **over the cap** (250,000 against Company C's 200,000 cap / or trigger the injected
failure). It aborts inside the transaction. Pan back to the balances, unchanged, to the cent. Then
run the **clean under-cap settle**: every leg flips to Settled in one commit, a real tx id appears,
balances update to the net positions.

**Narration:**
"Settlement is all-or-nothing. First I push a settle that breaks a rule. It aborts inside the Canton
transaction, and here's the point: the balances didn't move, not by a cent. No partial fills, no
timing risk. Now the clean run. Every net leg settles in one transaction, one commit, one tx id on
the ledger. A ends net plus fifteen, B plus thirty, C minus forty-five, and they sum to zero."

**Why judges care:** atomic DvP with a provable zero-movement abort is the whole reason to settle on
a ledger instead of over SWIFT.

---

## Money moment 3, Invoice in, obligation out, via the AI extractor (1:32 to 2:08)

**On screen:** Go to `/app/obligations`. Drop an invoice image on the dropzone. The agent reads it
with NVIDIA NIM vision and pre-fills amount, counterparty, due date, and reference. Confirm it, and
an `Obligation` lands on the ledger tagged as agent-sourced. Note the manual-entry fallback beside it.

**Narration:**
"This is the AI-proposes half. I drop a raw invoice. The agent reads it, amount, counterparty, due
date, reference, and proposes an on-ledger obligation. I approve, and it's on Canton, tagged as
agent-created. The human stays in the loop, manual entry is always right there. AI does the typing;
the ledger holds the truth."

**Why judges care:** shows a real ingestion path from a messy document to a signed on-ledger
obligation, not a hand-typed demo row.

---

## Money moment 4, An AI agent drives NetChain and gets policy-blocked (2:08 to 2:44)

**On screen:** Switch to the agent console / MCP client. The agent calls NetChain's tools over the
MCP server: record the invoice as an obligation, run the netting cycle, then **attempt to settle
over-cap**. The ledger rejects the over-cap settle. Show the rejection reason (the TreasuryPolicy
cap). Zero funds move.

**Narration:**
"Now the same flow with no human at the keyboard. An AI agent calls NetChain's tools over our MCP
server: it records the obligation, runs the cycle, then tries to settle above the cap. And it's
blocked, not by a guardrail in the prompt, by the TreasuryPolicy on the ledger. This is bounded
authority for agents done right. You hand the agent the tools and keep the limit somewhere the agent
can't reach, the ledger itself."

**Why judges care:** this is the 2026 agent-safety problem answered concretely, and it straddles
Track 3 without loosening a single Track 1 guarantee.

---

## Close (2:44 to 3:00)

**On screen:** Back to the deck, the Devnet / SCU proof slide, then the title.

**Narration:**
"Everything you saw ran live on Canton Devnet. We even shipped a settlement fix as a live smart
contract upgrade, v1.0.0 to v1.0.1, without taking the demo down. Confidential netting, atomic
settlement, a policy the ledger enforces, and an agent that can't overstep it. NetChain. Settle
everything, reveal nothing."

---

### Timing cheat sheet

| Beat | Window | Money moment |
|------|--------|--------------|
| Hook + thesis | 0:00 to 0:18 | Set the frame |
| 1 | 0:18 to 0:52 | Live 404 privacy (C fails, A resolves) |
| 2 | 0:52 to 1:32 | Atomic settle: over-cap abort (zero movement) then clean settle |
| 3 | 1:32 to 2:08 | Invoice in, agent-created obligation out |
| 4 | 2:08 to 2:44 | AI agent via MCP, policy-blocked on over-cap settle |
| Close | 2:44 to 3:00 | Live Devnet + SCU, tagline |

### Delivery notes

- One thesis line, then show, do not narrate over dead air. Let the 404 and the tx id sit on screen
  for a beat each.
- Keep every real artifact visible: the `CONTRACT_NOT_FOUND`, the unchanged balances on the abort,
  the settle tx id, the policy rejection reason.
- If asked live "is this really on Canton?", the answer is the package id `8d20d87f...6e8254` on
  Devnet and the live upgrade from `cdd7...55e7`. Have it ready.
- Truthful framing: settlement is on a placeholder Cash token today; USDCx via CIP-56 is an adapter,
  not a rewrite (`docs/USDCX_SPIKE.md`). Do not claim real USDCx moved.
