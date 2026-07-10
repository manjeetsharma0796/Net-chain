# NetChain — Confidential Treasury Settlement

Privacy-preserving multilateral netting & atomic settlement on the Canton
Network. This repository is the **hackathon demo frontend only**: no
blockchain, Daml, wallet, or LLM calls — everything is mocked behind typed
interfaces so real integrations drop in later without a rewrite.

**Tracks:** Track 1 · Private DeFi + Track 3 · Agentic Commerce

## Setup

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build (verified clean)
```

Stack: Next.js 14 (App Router) · TypeScript · Tailwind CSS · Framer Motion ·
Lucide React · Zustand. Fonts: Schibsted Grotesk (display/body) + Newsreader
italic (headline accent words) + IBM Plex Mono (all figures, party IDs,
hashes) via `next/font/google`.

## Routes

| Route                | What it is                                                        |
| -------------------- | ----------------------------------------------------------------- |
| `/`                  | Marketing landing: settlement-instruction hero artifact, Canton-primitives marquee, thesis, how-it-works, privacy model, footer |
| `/app`               | Dashboard — Canton Scan stats (mock), USDCx balance, cycle status, activity feed |
| `/app/obligations`   | Party-scoped obligations table, invoice dropzone (agent), manual entry fallback |
| `/app/privacy-check` | Your ledger projection vs. a refused foreign-contract query       |
| `/app/cycle`         | Netting operator console + party-scoped net-position view         |
| `/app/settlement`    | Allocation → atomic all-or-nothing settlement, failure injection  |
| `/app/policy`        | On-ledger `TreasuryPolicy` + rogue-agent rejection demo           |

The **party switcher** in the top bar (Company A / B / C) is the mock auth:
switching re-scopes every read in the app to that party's ledger projection.

## The four demo moments

1. **Counterparty privacy** — `/app/privacy-check`. Logged in as Company A,
   the left panel shows A's projection with foreign contracts undisclosed;
   click **"Fetch foreign contract"** to query a B↔C contract by exact ID and
   receive `CONTRACT_NOT_FOUND` — the ledger won't even confirm it exists.
   Switch party in the top bar and watch both panels flip.

2. **AI as the front door** — `/app/obligations`. Drop any PDF/image onto the
   dropzone. The agent "reads" it (mock OCR, ~2s scanline), pre-fills the
   review form with amount/counterparty/due date, and creating it puts an
   agent-labelled `Obligation` on the ledger. Manual entry is the
   always-works fallback.

3. **Atomic settlement** — `/app/cycle` → **Run netting cycle** (6 gross
   obligations, 460k, collapse to net positions summing to zero), then
   `/app/settlement` → **Allocate USDCx** → **Settle atomically**. Every leg
   flips to Settled in the same commit and a tx hash appears. Tick
   **"Inject a leg failure"** first to see the abort: all legs revert
   together, nothing moves.

4. **Non-bypassable policy** — `/app/policy`. Click **"Agent attempts
   over-threshold settlement"**: the agent proposes 250,000 USDCx, above
   Company A's `maxSettlementPerCycle` of 200,000, and the on-ledger policy
   rejects it — the console shows the exact rule that fired.

## Where real integrations plug in

- **`lib/api.ts`** — the single seam. Every read is party-scoped (functions
  take the requesting party and filter in the data layer, not the UI).
  Replace these async getters with Canton Ledger JSON API / Scan API calls;
  the signatures are the contract.
- **`lib/types.ts`** — mirrors the Daml contract shapes (`Obligation`,
  `NettingCycle`, `NetPosition`, `TreasuryPolicy`, `SettlementLeg`).
- **`lib/mock/data.ts`** — the seed ledger: 3 companies, 6 obligations that
  net to zero (gross 460k → net 45k, 90.2% compression), one open cycle, one
  policy per party.
- **`components/InvoiceDropzone.tsx` + `extractInvoice()`** — swap the mock
  extraction for a real document-AI call.
- **`lib/store.ts`** — client session state (Zustand); would shrink to UI
  state once reads come from a real ledger.

## Live ledger integration (opt-in)

The mock seam now has a real counterpart. Set `NEXT_PUBLIC_LEDGER_LIVE=1` (plus the
server-side `.env` values — `CLIENT_SECRET`, `NETCHAIN_PKG_ID`, and the party ids
written by `daml/deploy.sh`) and the app reads/writes the deployed Daml contracts on
the Canton Devnet validator instead of the mock. Path:

`pages → lib/ledger.ts (same signatures as lib/api.ts) → app/api/ledger/* (server, holds
the M2M token) → JSON Ledger API v2`. The secret never reaches the browser. With the flag
off, everything runs the original mock demo — nothing hard-breaks. Bring up on-ledger state
first with `cd daml && source ../.env && ./deploy.sh`. CI (`.github/workflows/daml.yml`)
builds + tests the DAR on Linux.

## Contributor tooling

The **ponytail** YAGNI/laziness skill is vendored into `.claude/skills/` (MIT), so every
Claude Code session in this repo picks it up automatically — no install. Invoke with
`/ponytail` (levels: lite/full/ultra).

## Design system

- Background `#0C0C0C`, text `#D7E2EA`, steel-gradient `.brand-heading`.
  Near-monochrome with one brand accent: mint `#38E1A4` (also settled/
  positive). Other semantics: pending `#F5C451`, rejected `#FF5C5C`,
  privacy/lock steel blue `#7FA6C9`. The primary CTA is a solid frost pill
  with ink text — one per screen, no gradients.
- Motion primitives in `components/motion/`: `FadeIn`, `Magnet`,
  `AnimatedText`, `StickyStack`. All respect `prefers-reduced-motion`.
- Every monetary value renders through `MoneyValue` (mono, tabular numerals).

## Explicitly out of scope

No bridge, order book, matching engine, real chain or LLM calls. Fully
operator-blind netting (MPC/ZK) is named as future work on the landing page —
it is a roadmap item, not a claim.
