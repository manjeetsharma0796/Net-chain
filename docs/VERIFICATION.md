# NetChain Verification Guide

Audience: Manjeet, verifying that the live product genuinely runs on Canton before
submission, not that it just looks convincing in a UI. Everything below is checked
against the code in this repo (`lib/ledger.ts`, `app/api/ledger/[op]/route.ts`,
`lib/ledger-server.ts`, the `app/app/*` pages, `mcp/`) and against the live deployment,
not aspirational.

**Live app:** https://netchain.vercel.app
**Package:** v1.0.4 (pkg id: see TASKS.md), on the 5N Devnet (Canton Protocol Version 35). v1.0.4
adds maker-checker (four-eyes) governance for treasury-cap changes (Scenario G); it is a valid Smart
Contract Upgrade of v1.0.3 `219a350c3940b76031a2d8c55b29a6bb9f8923f307918fa107b974bc3361eed0`, which
itself added bilateral confirmation (Scenario F) as an upgrade of v1.0.2 `afd2a89d…be2c57e`. (The
orchestrator fills in the v1.0.4 package hash on deploy.)

---

## 1. Key terminology, with simple analogies

- **Multilateral netting**: instead of every party paying every other party
  separately, you collapse the whole web of IOUs down to one net payment per party.
  Like a group of friends settling a shared dinner tab: instead of six separate
  transfers, whoever owes the least just tops up whoever is owed the most, once.
- **Atomic settlement / DvP (Delivery-versus-Payment)**: every net payment ("leg")
  moves in one indivisible step, or none of them do. Like an escrow that only ever
  flips the whole deal at once, there is no state where some money moved and some
  didn't.
- **Per-party privacy / sub-transaction privacy**: each party sees only its own
  slice of a shared transaction. Like a shared spreadsheet where you can only see
  your own rows, everyone else's rows aren't greyed out, they simply aren't in your
  copy of the document at all.
- **Net position**: one party's single number for the cycle (what it owes minus
  what it is owed), the output of netting.
- **Daml party**: an on-ledger identity, an account on the ledger that can hold
  contracts and authorize actions, roughly analogous to a bank account holder's
  identity, not a login.
- **The operator**: the netting bank, the one coordinating party that can see the
  full graph of obligations across A, B, and C and runs the netting cycle. Everyone
  else only ever sees their own slice. The operator *does* see everything, that is
  the standard trusted-operator model (see "The privacy model, honestly" below), not
  an accident, and NetChain's privacy guarantee is between *counterparties*, not
  against the operator.
- **Bilateral confirmation / bilateral consent** (v1.0.3): an obligation only counts
  toward settlement once the obligee has confirmed it on-ledger (the `Accept` choice).
  Like a two-signature cheque: the obligor writes it, but it clears only when the
  payee countersigns. This is the on-ledger safeguard against a fabricated ("fake
  invoice") obligation settling, an unaccepted obligation nets to zero.
- **`TreasuryPolicy` cap**: an on-ledger spending limit (`maxSettlementPerCycle`)
  written into the contract itself. An agent, or a human, cannot exceed it by
  crafting a cleverer request, the ledger itself refuses the transaction. The cap is
  not frozen, but neither party can change it alone: changes go through maker-checker
  (four-eyes) governance, the party proposes a new cap and the operator approves it
  on-ledger (Scenario G).
- **Maker-checker / four-eyes** (v1.0.4): a segregation-of-duties control where the
  action one party proposes (the maker) only takes effect when a second party approves
  it (the checker). NetChain applies it to cap changes: the party is the maker
  (proposes a new `maxSettlementPerCycle` on its own policy), the operator is the
  checker (approves, rejects, or the party withdraws). This is the SOX/Basel/treasury
  standard for limit changes, and the operator still cannot unilaterally raise a
  party's cap, it can only approve what the party itself proposed.
- **`updateId`**: the ledger's receipt for a committed transaction, the equivalent
  of a bank transfer reference number, proof a specific write actually happened.
- **Smart Contract Upgrade (SCU)**: upgrading the code behind a contract that is
  already live and holding state, without downtime and without re-seeding data.
  Like patching a running service instead of taking it down and standing up a new one.
- **MCP server**: a small adapter (`mcp/`) that lets any AI agent (Claude or
  otherwise) call NetChain's real API as a set of tools, so an agent can drive the
  same on-ledger flow a human would through the UI.

---

## 2. Positioning (from the market research)

NetChain's buyer is corporate treasury and shared-service-center teams running an
in-house-bank or netting-center model, the same buyer as Kyriba, Coprocess/GTreasury,
and SAP In-House Cash. Every incumbent researched in `docs/PRODUCT_RESEARCH.md` falls
into one of two camps: netting incumbents compute multilateral net positions but hand
off to conventional, non-atomic bank rails (an instruction file, then a separate
execution step days later), or DLT-native settlement players (Partior, Fnality, J.P.
Morgan Kinexys) settle atomically on a ledger but only bilaterally, with no
confidential N-party net-position computation. No researched competitor sits at the
intersection of both.

NetChain's thesis is that intersection: confidential N-party netting (an operator
sees the full obligation graph, counterparties stay blind to each other's positions)
combined with atomic, all-or-nothing settlement of every net leg inside one ledger
transaction. In January 2026, Ripple/GTreasury shipped a "TMS with native digital
asset capabilities" that fuses the exact netting category with a blockchain rail,
the most credible near-term competitive threat, but its public materials claim
neither privacy of net positions nor atomic settlement of the netted legs. J.P.
Morgan bringing JPM Coin (JPMD) natively to Canton in the same month, explicitly for
privacy properties its own Kinexys rails lack, is independent third-party validation
that this combination is a real, not-yet-commoditized property, not a solved problem.

This is a thesis demonstrated on a hackathon Devnet, not a production claim. The repo
is primarily **Track 1 (Private DeFi & Capital Markets)**, and also reaches into
**Track 3 (Agentic Commerce)** because the MCP server (`mcp/`) lets any AI agent
drive the same flow, bounded by the on-ledger `TreasuryPolicy` cap it cannot bypass,
a working answer to "how do you give an agent real authority without giving it an
unbounded blast radius."

---

## 2b. The privacy model, honestly (operator sees everything, so what's the point?)

A fair first reaction: if the operator can see the whole obligation graph, what is
actually private? The precise, honest answer:

- **NetChain's privacy is counterparty privacy, and that is the commercially valuable
  kind.** Company A and Company C cannot see each other's obligations, volumes, or who
  they trade with. That is the confidentiality every real netting service (CLS, CHIPS)
  provides *between its members*, and it is exactly what a corporate treasurer cares
  about: your positions never leak to a competitor or a counterparty. Verify it
  yourself in Scenario A, the ledger returns a real 404 to C, not a UI mask.
- **The operator seeing all is the standard, trusted-operator model**, identical to how
  CLS, CHIPS, and every in-house-bank netting center works today. It is a regulated,
  contractually-bound intermediary, not an eavesdropper. So "operator sees all" is not
  a weakness versus the market; NetChain already goes *beyond* incumbents like
  Kyriba/SAP by giving counterparties a cryptographic/ledger boundary rather than mere
  database access control (where a DB admin can peek).
- **Bilateral confirmation hardens trust even under a trusted operator** (v1.0.3, new).
  Because an obligation must be accepted by the obligee before it can net, neither a
  rogue party nor the operator can unilaterally inject a debt that settles. See
  Scenario F.
- **Removing the operator-trust assumption entirely is roadmap, named honestly** in
  `docs/SETTLEMENT_DESIGN.md` §6: *operator-blind netting*, where even the operator
  computes the net without seeing individual obligations (only the zero-sum result),
  via MPC, zero-knowledge proofs, or a TEE. This is the genuine research frontier
  (BIS/Zama work, the Cycles Protocol direction) with a real latency/scalability cost,
  which is why it is future work and not in this demo. NetChain's design is staged
  toward it, not pretending to already be there.

---

## 3. How to tell it is REAL, not mock (the general test)

Every page in `/app` has a **LIVE** or **MOCK** badge in the top bar
(`components/app/TopBar.tsx`), sourced straight from the `NEXT_PUBLIC_LEDGER_LIVE`
build flag. On the deployed app this reads **LIVE**. That alone is a claim, not
proof, so cross-check it against the API directly.

**The general test:** whatever number the UI shows for balances, obligations, or a
settlement tx id, it should match what you get calling the same read-only API the
frontend calls, `app/api/ledger/[op]/route.ts`, directly with curl. If the UI number
and the raw API number ever disagree, something is wrong; if they agree, the number
in front of you came from the validator, not from a hardcoded seed.

```bash
# All three on-ledger Account balances (operator-scoped read)
curl -s https://netchain.vercel.app/api/ledger/balances

# One party's obligations (real ledger contracts, party-scoped)
curl -s "https://netchain.vercel.app/api/ledger/obligations?party=company-a"

# One party's net position for the last computed cycle
curl -s "https://netchain.vercel.app/api/ledger/net-position?party=company-a"

# On-ledger TreasuryPolicy cap for a party
curl -s "https://netchain.vercel.app/api/ledger/policy?party=company-a"

# Real chronological activity feed (obligation/cycle/settle events from ledger history)
curl -s https://netchain.vercel.app/api/ledger/activity
```

What makes these convincing, not just JSON that could be faked:

- **Real 404s, not UI masking.** `GET /api/ledger/contract?party=<X>&contractId=<Y>`
  returns HTTP 404 `{"error":"CONTRACT_NOT_FOUND"}` when `<X>` is not a stakeholder
  on that contract, and HTTP 200 with the payload when it is. This comes straight
  from `getContract()` in `lib/ledger-server.ts` querying the validator's per-party
  active-contract-set projection, there is no `if (party !== owner) hide()` branch
  in application code to fake. See Scenario A below for the exact commands.
- **Real `updateId`s.** `POST /api/ledger/settle` and `POST /api/ledger/obligation`
  return an `updateId` straight from the validator's `submit-and-wait` response
  (`lib/ledger-server.ts`), a receipt for a specific committed transaction, not a
  client-generated hash. (The mock fallback path uses `newTxHash()`, a fabricated
  hash, precisely so you can tell the two apart if you ever see one.)
- **Switching party re-scopes reads for real.** The party switcher in the top bar
  sets `currentPartyId` in the client store; every subsequent read goes out with a
  different `?party=` query param and gets a genuinely different, smaller result
  set back from the validator, not the same payload with rows hidden client-side.
- **Silent fallback is the one thing to watch for.** If the flag is on but the
  validator is unreachable, `lib/ledger.ts` degrades to the mock (`lib/api.ts`)
  without a hard error, by design, so a demo never hard-breaks mid-flight. Section 6
  below explains how to tell the two apart when the badge alone doesn't.

---

## 4. Test scenarios

Party ids used in the API are `company-a`, `company-b`, `company-c` (see
`PARTY_IDS` in `lib/ledger-map.ts`); the operator is not switchable from the UI.

### Scenario A: Counterparty privacy (`/app/privacy-check`)

**What to click:**
1. Open https://netchain.vercel.app/app/privacy-check with the party switcher set to
   **Company C**.
2. Click **"Fetch foreign contract"** on the right panel. This queries a specific
   Company A ↔ Company B obligation by its exact contract ID, authenticated as C.
3. Switch the top-bar party to **Company A** and click the same button again (or
   reload; A's own projection now includes that contract).

**What to expect:** as C, the panel shows **"You cannot access this contract"** with
a message stating the ledger does not even confirm the contract exists. As A (a
real stakeholder), the same contract ID resolves.

**How to verify it is real:**
```bash
# Get an A<->B contract id from A's own projection
curl -s "https://netchain.vercel.app/api/ledger/obligations?party=company-a"
# Copy a contractId from the response, then:

# As C: expect HTTP 404, CONTRACT_NOT_FOUND
curl -si "https://netchain.vercel.app/api/ledger/contract?party=company-c&contractId=<ID>" | head -1

# As A: expect HTTP 200 with the payload
curl -si "https://netchain.vercel.app/api/ledger/contract?party=company-a&contractId=<ID>" | head -1
```
The UI's "denied" state and the curl 404 must both fire on the same contract ID at
the same time; there is no UI-only mask here, `route.ts` returns the 404 itself.

### Scenario B: Full netting flow (obligations to cycle to settlement)

**What to click:**
1. `/app/obligations`: as any party, check the obligations table is populated (real
   ledger-sourced rows, `getObligationsFor`).
2. `/app/cycle`: in **Operator view**, confirm the open obligations list, then click
   **"Run netting cycle"**. Wait for **"Net positions, operator output"** to appear.
   Confirm **"Σ nets = 0"** (net positions across all parties sum to zero, so
   nothing was created or destroyed, only redistributed).
3. Click **"Continue to settlement"**.
4. `/app/settlement`: click **"Allocate USDCx"**, wait for **"Allocated ✓"**, then
   click **"Settle atomically"**. Every leg should flip to **Settled** together and
   a **"tx <hash>"** line should appear.

**What to expect:** account balances move from a starting 100k/100k/100k baseline to
the demonstrated live result, **A=115k, B=130k, C=55k** (nets +15k / +30k / -45k,
summing to zero), as recorded in `TASKS.md` and `docs/ARCHITECTURE.md` from the live
Devnet run. Your own run's exact numbers depend on whatever obligations are open at
the time, but the same invariant (nets sum to zero, gross collapses to a smaller net)
must hold.

**How to verify it is real:**
```bash
# Before settling
curl -s https://netchain.vercel.app/api/ledger/balances

# ... run the cycle and settle in the UI ...

# After settling: balances must have moved and match what the settlement page shows
curl -s https://netchain.vercel.app/api/ledger/balances
```
The `tx <hash>` shown on the settlement page is the real `updateId` returned by
`POST /api/ledger/settle` (see `settleLive()` in `lib/ledger.ts`), you can watch this
call in the browser's network tab: it is a same-origin POST to
`/api/ledger/settle`, and the JSON body it returns contains the exact hash rendered.

### Scenario C: Non-bypassable policy (`/app/policy`)

**What to click:** on `/app/policy`, click **"Agent attempts over-threshold
settlement"**. The console animates `agent> propose Settle {amount: 250,000 USDCx}`,
then `ledger> validating against TreasuryPolicy...`, then **"Rejected on-ledger"**
with the specific rule that fired.

**What to expect:** the agent's proposed amount (250,000 USDCx in the demo) exceeds
the active party's on-ledger `maxSettlementPerCycle` (Company A's cap is 200,000).
The rejection message reads `COMMAND_FAILED: TreasuryPolicy assertion violated`, and
states there is "no override flag exists for the agent to set."

**How to verify it is not a mock:**
```bash
# Confirm the on-ledger cap directly
curl -s "https://netchain.vercel.app/api/ledger/policy?party=company-a"

# Dry-run the same over-cap amount the UI just attempted
curl -s -X POST https://netchain.vercel.app/api/ledger/policy-check \
  -H "Content-Type: application/json" \
  -d '{"party":"company-a","amount":250000}'
```
The policy page reads `maxSettlementPerCycle` live from the deployed contract
(labelled "live" on the page when the read succeeds); the other fields shown
(`allowedCounterparties`, `allowedInstrument`, `requiresHumanApprovalAbove`) are
explicitly marked "policy metadata" in the UI because they are not yet on the
deployed `TreasuryPolicy` template, only the cap itself is enforced on-ledger today.
Do not present those other fields as on-ledger enforcement, they are illustrative. The
cap is enforced but not frozen: it is changed only through maker-checker governance
(party proposes, operator approves), never by either party alone, see Scenario G.

### Scenario D: The AI agent via MCP (`mcp/`)

**Setup (one-time):**
```bash
cd mcp
npm install
npm run build
```
Add the server to your MCP client config (this repo's `.mcp.json`, or your global
Claude config):
```json
{
  "mcpServers": {
    "netchain": {
      "command": "node",
      "args": ["mcp/dist/index.js"],
      "env": { "NETCHAIN_API_BASE": "https://netchain.vercel.app" }
    }
  }
}
```
**Restart Claude Code (or your MCP client) after adding this**, new MCP servers only
connect on a fresh start.

**What to run:** ask an agent to, in order: `create_obligation` for an amount you
know exceeds a party's cap, `run_netting_cycle`, then `check_policy` (should return
`{ ok: false, ruleFired: ... }`), then attempt `settle` anyway.

**What to expect:** `settle` fails, because the `TreasuryPolicy` check lives inside
the Daml `Settle` choice itself, not in the MCP server or the route handler. The MCP
server (`mcp/README.md`) is a thin pass-through, "every tool below is exactly one
`fetch` call against the already-deployed HTTP API... no business logic here", so
there is nothing in the MCP layer capable of bypassing the ledger's check.

**How to verify it is not a mock:** run `get_activity` (or curl
`/api/ledger/activity` directly) and confirm the rejected attempt and any prior
obligation/cycle events appear in the real chronological ledger history, in the
same order the agent issued them.

### Scenario E: The self-serve sandbox (`/onboard`)

**What to click:** go to https://netchain.vercel.app/onboard, enter a company name
and two counterparty names, click **"Launch sandbox"**. You land on `/app` able to
record obligations, net, and settle as your own company.

**What to expect:** this is explicitly a client-side sandbox
(`lib/store.ts: initSandbox`), a separate, isolated tenant that never touches the
shared live ledger. The onboarding page itself says so: "It runs entirely
client-side, separate from the live on-chain demo."

**How to verify it is not a mock (in the honest sense: it isn't meant to be one):**
the top-bar LIVE/MOCK badge in sandbox mode does not reflect real ledger reads for
your sandbox company, because there is no ledger for a self-serve sandbox tenant.
Confirm this is working as intended, not a bug, by checking that
`curl https://netchain.vercel.app/api/ledger/balances` still shows only the fixed
three demo parties (company-a/b/c), your sandbox company never appears there. A
hard reload of `/app` while in sandbox mode resets the sandbox state (see Section 5).

### Scenario F: Bilateral confirmation, the fake-invoice safeguard (`/app/obligations`)

This answers "what if someone submits a fake invoice?" A newly created obligation is
**pending** (`accepted = false`) and is *excluded from netting* until the obligee
confirms it on-ledger with the `Accept` choice. A fabricated debt therefore cannot
settle on one party's say-so.

**What to click:**
1. `/app/obligations`: with the party switcher set to the **obligor**, record a new
   obligation to some obligee. The new row shows **"Awaiting counterparty acceptance"**.
2. Switch the party to that **obligee**. The same row now shows **"Pending your
   acceptance"** with an **Accept** button. Click it.
3. The row flips to accepted. Now run a cycle (`/app/cycle`), only accepted
   obligations contribute to the net.

**What to expect:** before acceptance, the pending obligation contributes **nothing**
to any net position (run the cycle with only a pending obligation and every net is
zero). After the obligee accepts, the same obligation nets normally.

**How to verify it is real (on-ledger, not a UI flag):**
```bash
# Create an obligation (starts pending: accepted=false)
curl -s -X POST https://netchain.vercel.app/api/ledger/obligation \
  -H "Content-Type: application/json" \
  -d '{"obligor":"company-a","obligee":"company-b","amount":10000,"reference":"TEST","dueDate":"2026-08-01"}'

# Read it back as the obligee; note "accepted": false on the new row
curl -s "https://netchain.vercel.app/api/ledger/obligations?party=company-b"

# Accept it as the obligee (contractId from the read above)
curl -s -X POST https://netchain.vercel.app/api/ledger/accept \
  -H "Content-Type: application/json" \
  -d '{"obligee":"company-b","contractId":"<ID>"}'

# Read again; the row now shows "accepted": true
curl -s "https://netchain.vercel.app/api/ledger/obligations?party=company-b"
```
The enforcement is in the Daml contract itself, not the UI: `ComputeNetPositions`,
`ComputeNetPositionsExcluding`, and the `Settle` mark-loop in `daml/daml/NetChain.daml`
all filter to `accepted == Some True`, and the `Accept` choice is controlled by the
obligee (`controller obligee`), so only the obligee can consent. The test
`test_bilateral_consent` in `daml/daml/Test.daml` proves a pending obligation nets to
zero and the same obligation nets +40k/-40k once accepted.

### Scenario G: Maker-checker cap change (four-eyes governance)

This answers "who can change a party's spending limit?" A cap change needs two parties:
the **party** proposes a new cap on its own `TreasuryPolicy` (the maker), and the
**operator** approves it (the checker). Neither can change a cap alone, and the
operator cannot unilaterally raise a party's cap, it can only approve what the party
proposed. This is the SOX/Basel/treasury segregation-of-duties standard.

**What to click:**
1. As the **party**, propose a new cap on your own policy. This creates a
   `TreasuryPolicyProposal` that is still pending, the live cap has not moved yet.
2. Switch to the **operator** and approve the proposal. `ApproveCapChange` atomically
   archives the old policy and issues the new cap in one commit. (The operator can also
   `RejectCapChange`; the party can `WithdrawCapChange` before approval.)
3. Re-read the party's policy, `maxSettlementPerCycle` now reflects the new cap.

**What to expect:** between propose and approve, the party's on-ledger cap is unchanged
(a proposal is not a policy). Only after the operator approves does the live cap change.

**How to verify it is real (on-ledger, not a UI flag):**
```bash
# Read the current cap
curl -s "https://netchain.vercel.app/api/ledger/policy?party=company-a"

# As the party (maker): propose a new cap
curl -s -X POST https://netchain.vercel.app/api/ledger/propose-cap \
  -H "Content-Type: application/json" \
  -d '{"party":"company-a","newCap":250000}'

# List pending proposals; copy the proposalCid of the new proposal
curl -s https://netchain.vercel.app/api/ledger/cap-proposals

# As the operator (checker): approve it
curl -s -X POST https://netchain.vercel.app/api/ledger/approve-cap \
  -H "Content-Type: application/json" \
  -d '{"proposalCid":"<CID>"}'

# Re-read the policy; maxSettlementPerCycle now shows the new cap
curl -s "https://netchain.vercel.app/api/ledger/policy?party=company-a"
```
Enforcement is in the Daml contract, not the UI: `TreasuryPolicyProposal.ApproveCapChange`
archives the old `TreasuryPolicy` and creates the new cap in the same transaction, so
there is no window where both exist or neither does. The controllers make segregation of
duties real, propose is controlled by the party, approve/reject by the operator, so
neither party can move a cap on its own. The test `test_cap_change_maker_checker` in
`daml/daml/Test.daml` proves a proposed cap only takes effect after the operator approves.

---

## 5. If something looks wrong

- **The badge says LIVE but numbers don't match your curl calls.** Check whether a
  request silently fell back to the mock: `lib/ledger.ts` degrades to `lib/api.ts`
  on any network error or non-2xx response from `/api/ledger/*`, by design, so a
  demo never hard-breaks if the validator hiccups. Open the browser console, a
  `[ledger] live <fn> fell back to mock` warning is logged every time this happens
  (`warnFallback()` in `lib/ledger.ts`). No warning means the read was genuinely live.
- **The LIVE vs MOCK badge is the fastest sanity check**, but it is a build-flag
  indicator, not a per-request guarantee (see above): trust the console warning and
  the curl cross-check over the badge alone if the two ever disagree.
- **The sandbox (`/onboard`) looks stuck or shows stale data.** It is pure
  client-side state (`lib/sandbox.ts` / `lib/store.ts`); a hard reload of `/app`
  resets it back to a fresh session. This is expected and does not affect the
  shared live ledger demo.
- **A settle or cycle action appears stuck ("Computing…" / "Committing…") forever.**
  Both the cycle and settlement pages catch ledger/network errors and revert the
  UI state with a toast rather than hanging (`app/app/cycle/page.tsx`,
  `app/app/settlement/page.tsx`); if you see an indefinite spinner, treat it as a
  genuine bug to report, not expected behavior.
- **Dashboard "network topology" stats (validators, governance, rounds) look static
  or suspiciously round.** This is the one honestly-documented remaining mock
  (`TASKS.md` T62): the Canton Scan API isn't reachable from this deployment's
  setup, so those specific figures are labeled "(mocked)" in the UI. Canton Coin
  price and market cap on the same dashboard are real, live via CoinGecko. Do not
  treat the topology numbers as a red flag, they are the one disclosed exception.
