# NetChain: Confidential Treasury Settlement

Privacy-preserving multilateral netting and atomic settlement on the Canton Network.
The Daml contracts are **deployed live on the Canton Devnet** (5N Sandbox validator) and the
Next.js app reads and writes them through the JSON Ledger API v2. The app also ships a full
mock mode, so the demo runs with zero backend when you want it to.

**Tracks:** Track 1 (Private DeFi) and Track 3 (Agentic Commerce)

**Live status:** package `8d20d87f...6e8254` (v1.0.1) deployed on Devnet (Canton Protocol Version 35,
PV35 gate passed). Settled demo cycle on-ledger: A=115k, B=130k, C=55k; net positions +15k / +30k /
-45k (sum zero). Verified end to end against the live validator.

## Positioning

The netting market splits into two camps (`docs/PRODUCT_RESEARCH.md`): incumbents (Kyriba,
Coprocess/GTreasury, SAP IHC, Ripple Treasury) that compute net positions then hand off to
non-atomic bank rails, and DLT settlement players (Partior, Fnality, J.P. Morgan Kinexys) that
settle atomically but only bilaterally. NetChain's design thesis is the combination neither camp
has: confidential N-party netting, counterparties blind to each other's positions, plus atomic
on-ledger settlement of every net leg, on Canton. In Jan 2026 Ripple/GTreasury shipped a "TMS with
native digital asset capabilities"; per the research, their public materials claim neither privacy
of net positions nor atomic settlement of the netted legs. This is a thesis demonstrated on a
hackathon Devnet, not a production claim.

|                | Net positions private from counterparties | Settlement atomic |
| -------------- | ------------------------------------------- | ------------------ |
| Netting incumbents (Kyriba, Coprocess/GTreasury, SAP IHC, Ripple Treasury) | No, conventional access control | No, instruction file then a separate execution step |
| DLT settlement (Partior, Fnality, Kinexys)                                 | No, bilateral/permissioned visibility | Yes, bilaterally |
| NetChain                                                                   | Yes, Canton per-party projection | Yes, across the full N-party net |

## Setup

```bash
npm install
npm run dev      # http://localhost:3000  (mock mode by default)
npm run build    # production build
```

Stack: Next.js 14 (App Router), TypeScript, Tailwind CSS, Framer Motion, Lucide React, Zustand.
Fonts: Schibsted Grotesk (display and body), Newsreader italic (accent words), IBM Plex Mono
(figures, party ids, hashes) via `next/font/google`.

## Run against the live ledger (opt-in)

By default the app runs on mock data. To read and write the real deployed contracts on the
Canton Devnet validator, create an untracked `.env` from `.env.example`, set `CLIENT_SECRET`
plus the party ids written by `daml/deploy.sh`, and set `NEXT_PUBLIC_LEDGER_LIVE=1`. Then:

```bash
cd daml && source ../.env && ./deploy.sh   # one-time: bring up on-ledger state
npm run dev
```

Call path: pages, then `lib/ledger.ts` (same signatures as the mock `lib/api.ts`), then
`app/api/ledger/*` (server route handlers that hold the M2M token), then the JSON Ledger API v2.
The `CLIENT_SECRET` never reaches the browser. If the flag is off, or the validator is
unreachable, the app falls back to the mock, so nothing hard-breaks. See `docs/ARCHITECTURE.md`
for the full diagram.

## Docs

- `docs/ARCHITECTURE.md`: end-to-end flow diagrams (browser to validator, and the netting run).
- `docs/CONTRACT_GUIDE.md`: how to call every template over the JSON Ledger API, verified live.
- `docs/CANTON_E2E_GUIDE.md`: the full API walkthrough and the gotchas that cost the most time.
- `daml/README.md`: the Daml package, build/test/deploy, and the frozen contract model.
- `TASKS.md` and `OPERATOR_TODO.md`: the task board and the human-only actions/decisions.

## Routes

| Route                | What it is                                                        |
| -------------------- | ----------------------------------------------------------------- |
| `/`                  | Marketing landing: settlement-instruction hero, Canton-primitives marquee, thesis, how-it-works, privacy model, footer |
| `/app`               | Dashboard: Canton Scan stats (mock), USDCx balance, cycle status, activity feed |
| `/app/obligations`   | Party-scoped obligations table, invoice dropzone (agent), manual entry fallback |
| `/app/privacy-check` | Your ledger projection vs. a refused foreign-contract query       |
| `/app/cycle`         | Netting operator console and party-scoped net-position view       |
| `/app/settlement`    | Allocation, then atomic all-or-nothing settlement, failure injection |
| `/app/policy`        | On-ledger `TreasuryPolicy` and rogue-agent rejection demo         |

The **party switcher** in the top bar (Company A / B / C) re-scopes every read to that party's
ledger projection. In live mode that is the real per-party ACS projection; in mock mode it is
the same scoping applied to seed data.

## The four demo moments

1. **Counterparty privacy** (`/app/privacy-check`). As Company A, the left panel shows A's
   projection with foreign contracts undisclosed. Click **"Fetch foreign contract"** to query a
   B/C contract by exact id and receive `CONTRACT_NOT_FOUND`: the ledger will not confirm it
   exists. In live mode this is a real 404 from the per-party projection. Switch party and both
   panels flip.

2. **AI as the front door** (`/app/obligations`). Drop any PDF or image on the dropzone. The
   agent "reads" it (mock OCR, about 2s), pre-fills the review form with amount, counterparty,
   and due date, and creating it puts an agent-labelled `Obligation` on the ledger. Manual entry
   is the always-works fallback.

3. **Atomic settlement** (`/app/cycle`, then `/app/settlement`). Run the netting cycle (6 gross
   obligations, 460k, collapsing to net positions that sum to zero), allocate, then settle. Every
   leg flips to Settled in one commit and a tx id appears. Tick **"Inject a leg failure"** first
   to see the abort: all legs revert together and nothing moves.

4. **Non-bypassable policy** (`/app/policy`). Click **"Agent attempts over-threshold
   settlement"**: the agent proposes 250,000 USDCx, above Company A's `maxSettlementPerCycle` of
   200,000, and the on-ledger policy rejects it. The console shows the exact rule that fired
   (which differs per party: some trip the cap, others trip the human-approval threshold).

## Architecture: where things live

- `lib/api.ts`: the mock seam. Every read is party-scoped in the data layer, not the UI.
- `lib/ledger.ts` + `app/api/ledger/*` + `lib/ledger-server.ts`: the live counterpart, same
  signatures as the mock, with the M2M secret held server-side.
- `lib/types.ts`: domain types mirroring the Daml contract shapes (`Obligation`, `NettingCycle`,
  `NetPosition`, `TreasuryPolicy`, `SettlementLeg`).
- `lib/mock/data.ts`: the seed ledger (3 companies, 6 obligations that net to zero, gross 460k to
  net 45k, one open cycle, one policy per party).
- `components/InvoiceDropzone.tsx` + `extractInvoice()`: invoice intake (mock OCR today).
- `lib/store.ts`: client session state (Zustand).
- `daml/`: the Daml package (5 templates), Script tests, and `deploy.sh`.

## Contributor tooling

The **ponytail** YAGNI/laziness skill is vendored into `.claude/skills/` (MIT) and wired
**always-on**: `CLAUDE.md` mandates the ladder for every code change and a `UserPromptSubmit`
hook re-states it each turn, so every contributor's session enforces it, with no install and no
opt-in. It fits the pipeline at **authoring** (the ladder gates every change) and **review**
(`/ponytail-review` on the diff before merge); it does not run in CI. Levels: `/ponytail
lite|full|ultra`; disable per session with "stop ponytail".

CI: `.github/workflows/daml.yml` installs DPM + SDK 3.5.2 on Linux and runs `dpm build` plus
`dpm test` (4 Script tests) on any change under `daml/`.

## Design system

- Background `#0C0C0C`, text `#D7E2EA`, steel-gradient `.brand-heading`. Near-monochrome with one
  brand accent: mint `#38E1A4` (also settled/positive). Other semantics: pending `#F5C451`,
  rejected `#FF5C5C`, privacy/lock steel blue `#7FA6C9`. The primary CTA is a solid frost pill
  with ink text, one per screen, no gradients.
- Motion primitives in `components/motion/`: `FadeIn`, `Magnet`, `AnimatedText`, `StickyStack`.
  All respect `prefers-reduced-motion`.
- Every monetary value renders through `MoneyValue` (mono, tabular numerals).

## Out of scope and future work

No bridge, order book, or matching engine. Invoice extraction is live for images via NVIDIA NIM
vision (the mock is only the fallback for PDFs or when no key is set). Canton network-topology
stats (validators, governance, rounds) are still mocked; the Canton Coin price and market cap are
live via CoinGecko. Fully operator-blind netting (MPC/ZK) is a named roadmap item, not a current
claim: today the operator is a known, authorized coordinator.
