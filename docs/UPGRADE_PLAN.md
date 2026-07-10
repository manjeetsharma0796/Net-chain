# NetChain Upgrade and Fix Plan (UI wiring + settlement, research-grounded)

This plan does two things: (1) fix the UI, which is mock-driven today, by wiring it to real ledger
and market data while keeping the visuals identical; and (2) upgrade the settlement model per the
research in `docs/SETTLEMENT_DESIGN.md` and `NetChain_Settlement_Design_Report.md`.

Guiding rule for every UI task: **same pixels, real data.** Do not restyle. Replace the data
source behind an existing component; keep its props, layout, animation, and copy. If a live call
fails, fall back to the mock so the demo never hard-breaks, but make the fallback visible in dev
(see T32) so a broken live path cannot masquerade as success.

## Audit: what is real vs mock today (measured)

Live calls exist on only four pages, and 39 store mutations drive what the user sees. Findings:

- **Dashboard (`app/app/page.tsx`)**: fully mock. Scan stats and Canton Coin price come from
  `getScanSnapshot` (mock); USDCx balance comes from the Zustand store. Zero ledger calls.
- **Cycle (`app/app/cycle/page.tsx`)**: fully mock and this is the biggest gap. "Run netting cycle"
  calls `computeNetPositions` in the browser over store obligations and sets store state. It never
  creates a `NettingCycle` or exercises `ComputeNetPositions` on-ledger. The party-view privacy is
  a CSS blur, not a ledger-enforced read. The flagship netting and privacy moment touches no ledger.
- **Settlement (`app/app/settlement/page.tsx`)**: mostly mock. `settleLive()` does fire and its real
  `updateId` is used as the tx hash, but the legs, the post-settle balances (`applySettlementBalances`,
  store math), and the abort path are all mock.
- **Obligations (`app/app/obligations/page.tsx`)**: partly real. `getObligationsFor` (read) and
  `createObligationLive` (write) are live, but `addObligation` also writes the store, so the list
  mixes store and ledger and can double-count after a create.
- **Privacy-check (`app/app/privacy-check/page.tsx`)**: the most real page. `getObligationsFor` and
  `queryContract` are live; the 404 is a genuine per-party projection miss.
- **Policy (`app/app/policy/page.tsx`)**: the `CheckSettlement` exercise is live and `ruleFired` is
  real; the displayed caps come from mock `TreasuryPolicy` data.

## UI wiring tasks (keep visuals identical)

- **T27 Dashboard live data.** Server route `/api/scan` that fetches Canton Coin (CoinGecko id
  `canton-network`, verified: CC ~$0.133, mcap ~$5.2B) and USDCx (`xreserve-bridged-usdc-canton`)
  with a short cache and a proxy fallback chain (try direct, then one or two proxies) so a timeout
  never blanks the tile. Wire the USDCx wallet balance to a live `Account` read per party. Keep the
  `NumberTicker` and stat-tile visuals exactly.
- **T28 Cycle page live netting (highest impact).** "Run netting cycle" posts to a route that creates
  the `NettingCycle` and exercises `ComputeNetPositions` on-ledger (operator), then reads the live
  `NetPosition` for the current party via `getNetPositionFor`. The party view then shows one figure
  because the ledger only discloses that party's `NetPosition`, not a CSS blur. Keep the compute
  animation, the net-position cards, the compression stat, and the operator-vs-party toggle.
- **T29 Settlement live results.** Derive legs from the live `NetPosition`s; after `settleLive`,
  re-read live `Account` balances so the post-settle numbers are real; keep using the real `updateId`
  as the tx id. Keep the allocate, settle, and inject-failure UX and the leg animation.
- **T30 Obligations ledger-sourced list.** In live mode, source the table from the ledger only and
  re-fetch after a create, so a created obligation appears once with its real state. Keep the table,
  the agent-review modal, and the manual-entry fallback.
- **T31 Policy live caps.** Read the live `TreasuryPolicy` for the displayed cap and counterparties.
  Keep the copy (already shows the real `ruleFired`).
- **T32 Live/mock indicator + fail-loud in dev.** A small badge (or dev-only console warning) that
  says whether a page rendered live or mock data, so the silent fallback cannot hide a broken live
  path during the demo. Visual-only addition, no restyle.

## Settlement upgrades (from the report)

- **T33 USDCx settlement via CIP-56 Allocation API (investigate first).** The report's central
  recommendation: settle in real USDCx (Canton's regulated bridged USDC, live as
  `xreserve-bridged-usdc-canton`) using CIP-56's Allocation API for the prefunding step, instead of
  our placeholder `Cash`/operator-account model. Precedent: CLS pay-in, CHIPS prefunding. First step
  is a spike: confirm CIP-56 / USDCx is usable by our M2M identity on the 5N devnet; if not, keep the
  `Cash` token and document USDCx as the production path.
- **T34 Privacy refinement: operator not on the obligation until cycle.** Per the report Phase 1, the
  operator should not observe individual `Obligation`s; it should see them only when they are pulled
  into a cycle. Today `Obligation` has `observer obligee, operator`. Change to remove the operator as
  a standing observer, and disclose obligations to the operator at cycle time. Tightens the privacy
  story (operator learns the graph only at netting, not continuously). Contract change + redeploy + test.

Related existing tasks: **T23** pre-cycle funding check (defaulter pays), **T24** auto drop-and-re-net,
**T25** partial settlement. These are the settlement-flow build items from `docs/SETTLEMENT_DESIGN.md`.

## Sequencing
1. T27 and T28 first: they convert the two fully-mock pages (dashboard, cycle) into real, and T28
   makes the flagship netting/privacy demo genuinely ledger-backed. High visible impact, no restyle.
2. T29, T30, T31, T32: finish wiring the remaining pages and add the live/mock indicator.
3. T23, T24: settlement robustness (prefunding, drop-and-re-net) with Daml Script tests.
4. T33 spike, then T34: move to the real settlement asset and tighten operator privacy, if the devnet
   supports CIP-56/USDCx.
