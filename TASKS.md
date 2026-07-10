# NetChain, Build Tasks

Privacy-preserving multilateral netting + atomic settlement on Canton.
Goal of this file: get NetChain from **mocked frontend** → **live on Canton Devnet**
before the deadline. Two of us, flat task pool, claim and update as you go.

> **Deadline:** Final submission **Mon 13 Jul 12:59 BST**. Working to 13 Jul (set).

---

## How this task system works

1. **Claim** a task by putting your name in **Owner** and setting **Status → 🟡**.
2. **Only start a task whose dependencies are ✅.** Grab the highest-priority
   unblocked task you can.
3. **Update this file** when you claim, finish, or get blocked. Commit it often and
   small so the other person always sees current state.
4. Prefer tasks in a **different track** from your partner so you don't collide.

**Status:** 🔲 Todo · 🟡 In progress · ✅ Done · ⛔ Blocked
**Priority:** **P0** = must exist to qualify · **P1** = makes the live product real ·
**P2** = polish
**Tracks:** `SETUP` · `DAML` · `FE` (frontend) · `AI` · `SHIP` (submission)

---

## Ground truth, deploy path

- **Toolchain (PINNED):** DPM (Daml Package Manager). Install
  `curl https://get.digitalasset.com/install/install.sh | sh` → `dpm install 3.5.2`.
  Build locally with **`dpm build`** → `.daml/dist/netchain-1.0.0.dar`.
- **Daml (PINNED):** SDK **3.5.2**, `build-options: [--target=2.3]` (LF 2.3); deps
  `daml-prim`, `daml-stdlib`, `daml-script`.
  ```yaml
  sdk-version: 3.5.2
  build-options: [--target=2.3]
  ```
- **Deploy:** upload via **`POST /v2/packages`** (`--data-binary @<dar>` + M2M Bearer
  token, verified working). Source lives in **this repo** (local authoring); the
  Seaport browser IDE is optional, for viewing only.
- **Validator:** `5N Sandbox (development)` · Generic OIDC ·
  API `https://ledger-api.validator.devnet.sandbox.fivenorth.io`
- ⚠️ **PV35 GATE (the one risk with this pin):** LF 2.3 requires the validator to accept
  **Canton Protocol Version 35**. **T01 must verify this by uploading a trivial
  `--target=2.3` DAR before we build the real contracts**, if `/v2/packages` rejects it on
  protocol/LF grounds, escalate in `#canton` / fall back to 3.4.x.
- **Frontend seam:** all reads/writes already funnel through `lib/api.ts` +
  `lib/store.ts`. Real integration = replace those with JSON Ledger API v2 calls;
  **keep the function signatures identical** so pages don't change.
- Docs: JSON Ledger API, https://docs.digitalasset.com/build/3.5/tutorials/json-api/canton_and_the_json_ledger_api.html

## Definition of Done (the qualification bar)

- [ ] Daml contracts **deployed live on Devnet** via Seaport (not LocalNet/sandbox).
- [ ] The 4 demo wins reproducible: **counterparty privacy**, **AI-created
      obligation**, **atomic settlement (with abort)**, **on-ledger policy rejection**.
- [ ] **Public repo** (clean, documented) · **deck** · **3-min video w/ demo** ·
      **link to live product**.

---

## Task pool

| ID | Pri | Track | Task | Owner | Status | Depends on |
|----|-----|-------|------|-------|--------|------------|
| T01 | P0 | SETUP | Seaport access + trivial deploy spike | Jishnu | ✅ | - |
| T02 | P0 | SETUP | Provision demo parties (A/B/C + operator) + tokens | Jishnu | ✅ | T01 |
| T03 | P0 | DAML | Scaffold `netchain` Daml project + agree shared types | Manjeet | ✅ | T01 |
| T04 | P0 | DAML | `Account` balance template (operator-issued) | Manjeet | ✅ | T03 |
| T05 | P0 | DAML | `Obligation` template (party-scoped) | Manjeet | ✅ | T03 |
| T06 | P0 | DAML | `NettingCycle` + `NetPosition` (real per-party privacy) | Manjeet | ✅ | T05 |
| T07 | P0 | DAML | `TreasuryPolicy` + atomic `Settle` choice | Manjeet | ✅ | T04,T05,T06 |
| T08 | P0 | DAML | Daml Script: 4 tests prove the 3 wins (all pass) | Manjeet | ✅ | T04–T07 |
| T09 | P0 | DAML | Deploy `.dar` to 5N Sandbox + run setup on-ledger | Jishnu | ✅ | T08,T02 |
| T10 | P1 | DAML | Mirror `daml/` source into the git repo | Manjeet | ✅ | T03 |
| T11 | P1 | FE | `lib/ledger.ts` JSON Ledger API v2 client (server-side token) | Jishnu | ✅ | T01,T02 |
| T12 | P1 | FE | Per-party identity/switcher → real projections | Jishnu | ✅ | T02,T11 |
| T13 | P1 | FE | Wire **reads** to the ledger (privacy first) | Jishnu | ✅ | T09,T11 |
| T14 | P1 | FE | Wire **writes** (create/cycle/allocate/settle/policy) | Jishnu | ✅ | T09,T11 |

> **DAML-interaction spine (branch `daml-interaction`, 2026-07-10), LIVE:**
> `daml/deploy.sh` ran end-to-end on the 5N devnet → settled **A=115k/B=130k/C=55k**,
> nets **+15k/+30k/−45k** (sum 0). All four wins verified through the route handlers
> (`NEXT_PUBLIC_LEDGER_LIVE=1`): privacy (C→404 / A→200 on the A→B contract), per-party
> net position, on-ledger policy gate (250k→AssertionFailed, 150k→ok). Stack:
> `lib/ledger.ts` → `app/api/ledger/*` → `lib/ledger-server.ts` → JSON Ledger API v2.
> CI in `.github/workflows/daml.yml`. **Note:** the shared M2M user is at its 1000-rights
> cap, so the demo reuses existing scratch parties (operator=Dave, A=Carol, B=Investor,
> C=SME) instead of fresh `netchain-*`; see `OPERATOR_TODO.md`. **Merged to `main` via PR #1**
> (CI green: dpm build + 4 script tests). Live ACS cleaned: 6 obligations, accounts 115k/130k/55k.
| T15 | P0 | SHIP | Deploy frontend live (Vercel): https://netchain.vercel.app | Manjeet/Jishnu | ✅ | - |
| T16 | P1 | AI | Real invoice extraction via LLM (NVIDIA NIM vision) | Jishnu | ✅ | - |
| T17 | P2 | FE | Fix the 3 conformance mismatches | Jishnu | ✅ | T13 (partial) |
| T18 | P0 | SHIP | Presentation deck | Jishnu | ✅ | - |
| T19 | P0 | SHIP | 3-min video pitch + demo recording | | 🔲 | spine live |
| T20 | P0 | SHIP | Repo cleanup + README rewrite | Jishnu | ✅ | near end |
| T21 | P1 | DOCS | End-to-end flow diagram (browser → API → ledger → settle) | Jishnu | ✅ | T14 |
| T22 | P1 | DOCS | Contract usage guide (frontend/backend via JSON Ledger API) | Jishnu | ✅ | T11,T14 |
| T23 | P1 | DAML | Pre-cycle funding check (fail-fast, defaulter-pays) + Script test | Jishnu | ✅ | T09 |
| T24 | P1 | DAML | Auto drop-and-re-net survivors on an underfunded payer + test | Jishnu | ✅ | T23 |
| T25 | P2 | DAML | Partial settlement / gridlock resolution (largest solvent subset) | Jishnu | ✅ | T24 |
| T26 | P1 | DOCS | Settlement design (research-grounded): `docs/SETTLEMENT_DESIGN.md` | Jishnu | ✅ | - |
| T27 | P1 | FE | Dashboard live data (CoinGecko **via proxy** + server cache; live USDCx balance) | Jishnu | 🟡 | T09 |
| T28 | P1 | FE | Cycle page: live `ComputeNetPositions` + per-party `NetPosition` read | Jishnu | ✅ | T09 |
| T29 | P1 | FE | Settlement: live legs + real post-settle balances (keep real tx id) | Jishnu | ✅ | T28 |
| T30 | P2 | FE | Obligations list ledger-sourced (dedupe store vs ledger) | Jishnu | ✅ | T13 |
| T31 | P2 | FE | Policy page: read live `TreasuryPolicy` caps | Jishnu | ✅ | T14 |
| T32 | P2 | FE | Live/mock indicator + fail-loud in dev (no restyle) | Jishnu | ✅ | - |
| T33 | P1 | DAML | USDCx settlement via CIP-56 Allocation API (spike) | Jishnu | ✅ | T09 |
| T35 | P2 | FE | TopBar USDCx balance: wire to `getBalanceLive` | Jishnu | ✅ | T11 |
| T36 | P2 | DAML | Optional: shape-only `Holding`/`Allocation` refactor mirroring CIP-56 (interim; real USDCx is no-go per `docs/USDCX_SPIKE.md`) | | 🔲 | T33 |
| T37 | P1 | FE | Cycle operator cards gross 0/0 in live mode: compute client-side | Jishnu | ✅ | T28 |
| T38 | P1 | FE | Policy page: cap is live; off-ledger fields (counterparties, instrument, approval-above) marked illustrative (not on the deployed `TreasuryPolicy`) | Jishnu | ✅ | T31 |
| T39 | P1 | FE | Fail-loud: `lib/ledger.ts` should tag live-vs-fallback and drive the LIVE badge + a dev warn (badge is build-flag-only today) | Jishnu | ✅ | T32 |
| T40 | P2 | FE | Agent/Manual source badge lost on live re-fetch (`toObligation` hardcodes source=manual; needs an `Obligation` source field to fix live) | | 🔲 | T30 |
| T41 | P2 | FE | Dedupe the 3-party-id literal to `PARTY_IDS` (copied in 5 places; `lib/ledger-map.ts` export unused) | Jishnu | ✅ | - |
| T42 | P2 | FE | Extract shared cycle-open-and-compute helper in `lib/ledger-server.ts` (dup in `computeNetPositionsOnLedger`/`runAndSettle`) | Jishnu | ✅ | - |
| T43 | P2 | DOCS | Em-dash sweep across tracked docs/source (per-line reword, not blind replace) | Jishnu | ✅ | - |
| T44 | P2 | DOCS | Refresh `docs/UPGRADE_PLAN.md` real-vs-mock audit table to current status (T28-T35 done) | Jishnu | ✅ | - |
| T45 | P1 | FE | ISO 20022 / CSV export of settled legs (feed an existing TMS/GL; #1 adoption blocker per `docs/PRODUCT_RESEARCH.md`) | Jishnu | ✅ | T14 |
| T46 | P1 | FE | Audit/reporting view mapping settled net legs back to underlying obligations (BEPS transfer-pricing; AFP top driver) | Jishnu | ✅ | T14 |
| T47 | P2 | SHIP | Positioning: explicitly vs Ripple/GTreasury (confidential N-party netting + atomicity), fold into deck/README | Jishnu | 🟡 | - |
| T34 | P2 | DAML | Privacy: operator not observer on `Obligation` until cycle | | 🔲 | T09 |

> **UI + settlement upgrade plan (T27–T34):** full per-task detail and the mock-vs-real audit are in
> [`docs/UPGRADE_PLAN.md`](docs/UPGRADE_PLAN.md). Rule for every FE task: same visuals, real data, mock
> fallback kept. Today the UI is mock-driven (dashboard and cycle make zero ledger calls; 39 store
> mutations drive the view); these tasks wire it to the live ledger and CoinGecko without restyling.

**Suggested parallelization (day 1):** one person takes **T01 → T02** (unblocks
everything on-ledger); the other starts **T03** (Daml scaffold, authoring needs no
deploy) and **T15/T18** in the gaps. After T01, the Daml templates (T04/T05) split
cleanly between two files; **T11** (ledger client) and **T16** (LLM) are fully
independent and can run the whole time.

---

## Task details

### T01 · P0 · SETUP, Toolchain + trivial DAR upload (PV35 gate)
De-risk deployment before writing real logic. Auth is already **proven** (token
exchange + `GET /v2/state/ledger-end` → `{"offset":N}` both work).
- Install DPM + SDK 3.5.2: `curl https://get.digitalasset.com/install/install.sh | sh`
  then `dpm install 3.5.2`.
- Scaffold a trivial 1-template package, `dpm build` (with `--target=2.3`), upload via
  `POST /v2/packages` (`--data-binary @<dar>` + Bearer token), and confirm the package id
  appears in `GET /v2/packages`.
- **Done when:** a `--target=2.3` DAR is **accepted (HTTP 200)** on the 5N Sandbox
  validator. ⚠️ If rejected on protocol/LF grounds the validator isn't PV35 → escalate /
  fall back to 3.4.x **before** building the real contracts.

### T02 · P0 · SETUP, Provision demo parties + tokens
- Allocate/identify Daml parties for **Company A, Company B, Company C, and the
  netting operator** on the validator; record their party IDs here.
- Work out how the frontend obtains an **OIDC token per party** for the JSON Ledger
  API (Generic OIDC), document the token flow, or the app-provider-token + `actAs`
  approach if per-user OIDC is too heavy. (Open item, confirm from Seaport docs / `#canton`.)
- **Done when:** party IDs listed + a documented way to authenticate as each party.

### T03 · P0 · DAML, Scaffold project + agree shared types
The coordination task that makes the rest independent.
- Local `netchain` DPM project. `daml.yaml`: `sdk-version: 3.5.2` ·
  `build-options: [--target=2.3]` · deps prim/stdlib/script. Build with `dpm build`.
  (Run the T01 PV35 trivial-DAR check FIRST.)
- 30-min sync: freeze the **template + choice signatures and the party model**
  (who is signatory vs observer on each contract) so T04–T07 can be built in separate
  files without churn. Mirror `lib/types.ts` shapes.
- **Done when:** project builds empty + a short type/signature contract is written
  below this line and both agree.

### T04 · P0 · DAML, `Cash` token template
Simple settlement instrument (own token; USDCx is the deck/"production" story).
- `Cash` with `issuer`, `owner`, `amount`. Owner-authorized `Transfer`/`Split`;
  issuer can `Mint`. Enough for atomic multi-leg settlement inside one transaction.
- **Done when:** can mint Cash to a party and transfer it in a Daml Script.

### T05 · P0 · DAML, `Obligation` template
- Fields: `obligor`, `obligee`, `amount`, `reference`, `dueDate`, `status`.
  **Signatories = obligor + obligee only** (propose/accept to create) → third parties
  can't see it. Add the operator as **observer** only when pulled into a cycle.
- **Done when:** A↔B obligation is invisible to C in a Daml Script (privacy proven).

### T06 · P0 · DAML, `NettingCycle` + `NetPosition`
Makes privacy **real at the data layer** (fixes the current UI-only shortcut).
- `NettingCycle` (operator + participants, references in-scope obligations).
- Operator computes each party's net; writes a `NetPosition` whose **only observer is
  that party**, so A cannot read B's net from the ledger, not just the UI.
- **Done when:** in a Script, each party can fetch exactly its own `NetPosition` and
  nets sum to zero (demo set: A +15k, B +30k, C −45k).

### T07 · P0 · DAML, `TreasuryPolicy` + atomic `Settle`
- `TreasuryPolicy` per party: `maxSettlementPerCycle`, `allowedCounterparties`,
  `allowedInstrument`, `requiresHumanApprovalAbove`.
- Allocation step (each net payer commits Cash to the cycle), then a single `Settle`
  choice that **transfers every leg in one transaction** (atomic by construction),
  **asserting the policy**, an over-threshold attempt fails on-ledger.
- **Done when:** a Script shows (a) all legs settle in one commit, (b) an over-cap
  attempt is rejected by the policy assertion, no funds move.

### T08 · P0 · DAML, Seed + proof script
- `setupDemo` seeds 3 companies, 6 obligations matching the current mock (gross 460k
  → net 45k, sums to zero), one policy per party, initial Cash.
- A test script demonstrates the **3 on-ledger wins** (privacy read refusal, atomic
  settle, policy rejection).
- **Done when:** script runs green in Seaport.

### T09 · P0 · DAML, Deploy + run on-ledger
- ✅ **Package deployed LIVE on Devnet** (2026-07-10): `dpm build` → uploaded via
  `POST /v2/packages` (HTTP 200), confirmed present in `GET /v2/packages`.
  - main package id: `cdd76816c72bba50c880ea7f8d48c9f78ae5d37e48706aa012cfeac80ee655e7`
  - ✅ **PV35 gate PASSED**, the 5N validator accepts LF 2.3, so the pinned toolchain
    (SDK 3.5.2 / `--target=2.3`) is validated end-to-end.
- ⬜ **Remaining (with T02):** allocate parties (operator + A/B/C), then create the demo
  contract instances on-ledger (accounts, policies, 6 obligations) → `ComputeNetPositions`
  → `Settle`, so the *state* is live, not just the package.
- **Done when:** the netting flow runs on the validator and NetPositions/Accounts are
  queryable via the JSON Ledger API. **Core qualification checkpoint.**
- 📗 **Runbook + frozen contract signatures (build / test / deploy, read this to continue,
  frontend included):** [`daml/README.md`](daml/README.md).

### T10 · P1 · DAML, Mirror source to repo
- Export the `daml/` folder + `daml.yaml` from Seaport into `Net-chain/daml/` and
  commit. Keep it current (public-repo requirement).
- **Done when:** `daml/` builds from the repo and matches what's deployed.

### T11 · P1 · FE, `lib/ledger.ts` JSON Ledger API client
- Thin client for JSON Ledger API v2 against the validator endpoint: create, exercise,
  query active contracts; inject the OIDC token from T02.
- Build/test against the deployed contracts. **Do not change page components.**
- **Done when:** can query the deployed `Obligation`s for one party from a local script/test.

### T12 · P1 · FE, Per-party identity
- Replace the mock party switcher's effect: switching party uses that party's
  token/projection so reads reflect the **ledger's** per-party view.
- **Done when:** logged in as A, the ledger itself returns only A's contracts.

### T13 · P1 · FE, Wire reads (privacy first)
- Reimplement `getObligationsFor`, `queryContract`, **and `getNetPositionFor`
  (currently unused!)** in terms of `lib/ledger.ts`; keep signatures identical.
- **Done when:** `/app/obligations`, `/app/privacy-check`, and the `/app/cycle`
  party-view read from the real ledger; the `CONTRACT_NOT_FOUND` moment is real.

### T14 · P1 · FE, Wire writes
- Route obligation-create, run-cycle, allocate, settle, and the policy attempt through
  real ledger exercises (via the store actions).
- **Done when:** creating an obligation and settling a cycle in the UI changes on-ledger
  state; a real tx id shows on the settlement screen.

### T15 · P0 · SHIP, Deploy frontend live
- ✅ **Live: https://netchain.vercel.app** (Vercel project `netchain`, account `akakak0796-5103`).
  Deployed with full production env, all secrets server-side. Verified live: obligations read
  returns the real per-party projection (company-a sees 4), the extract route is configured.
  (Manjeet prepped the build + env list; deploy completed this session.)
- **Env set in Vercel (production):** live ledger (`NEXT_PUBLIC_LEDGER_LIVE=1`, `BASE`,
  `TOKEN_ENDPOINT`, `CLIENT_ID`, `CLIENT_SECRET`, `AUDIENCE`, `SCOPE`, `USER_ID`,
  `NETCHAIN_PKG_ID`, `NETCHAIN_OPERATOR`/`_COMPANY_A`/`_B`/`_C`) and AI extraction
  (`NIM_API_KEY`, `NIM_BASE`, `NIM_VISION_MODEL`). App degrades to the mock demo if env is unset.
- ⚠️ Live mode is on, so the public URL can WRITE to the shared Devnet (create obligation,
  settle); a visitor can change the clean demo numbers. To freeze the public demo, set
  `NEXT_PUBLIC_LEDGER_LIVE=0` in Vercel and redeploy (then reads/writes use the deterministic mock).
- **Done when:** public URL is live; linked here. ✅

### T16 · P1 · AI, Real invoice extraction
- Replace mock `extractInvoice` with an LLM call (Grok **or** OpenRouter) that reads a
  dropped PDF/image and returns `{amount, counterparty, dueDate, reference, confidence}`.
  **Manual entry stays as the always-works fallback.**
- **Done when:** dropping a real invoice pre-fills the review form from actual content;
  creating it makes an **agent-sourced** obligation. Keep AI ≈20% of effort.

### T17 · P2 · FE, Fix conformance mismatches
- (a) Confirm net-position privacy is now **ledger-enforced** (should fall out of
  T06+T13). (b) Policy page copy: stop hardcoding "above your cycle cap", state the
  **actual rule that fired** for the active party (wrong today for B/C). (c) Hero
  subhead sells "receivables minus payables" (the SoT says don't sell the algorithm);
  fix `PrimitivesMarquee` "mainnet" → Devnet.
- **Done when:** copy is accurate for all three parties and matches positioning.

### T18 · P0 · SHIP, Deck
- Problem → the 4 wins → **honest privacy model** (counterparties blind; operator is a
  known authorized coordinator; MPC/ZK = future work) → architecture → Devnet proof.
- **Done when:** deck exported and linked here.

### T19 · P0 · SHIP, 3-min video
- Splitwise hook **once** in the first line, then sell **confidential settlement +
  on-ledger policy + atomic execution**. Demo the 4 wins against the live app.
- **Done when:** ≤3-min video recorded + linked.

### T20 · P0 · SHIP, Repo + README
- Rewrite README for the real deploy (Seaport steps, validator, architecture, what's
  live vs future). Remove "no blockchain / mock only" framing. Clean the repo.
- **Done when:** a stranger can understand and run it from the README.

### T21 · P1 · DOCS, End-to-end flow diagram
- One diagram (Mermaid in a Markdown doc) tracing the whole path: party switcher in the
  browser, `lib/ledger.ts` client shim, `app/api/ledger/[op]` route handlers, server token
  exchange in `lib/ledger-server.ts`, JSON Ledger API v2 on the 5N validator, and the
  ComputeNetPositions then Settle flow back to the UI. Show the mock fallback branch too.
- **Done when:** `docs/ARCHITECTURE.md` renders the flow and matches the live code paths.

### T22 · P1 · DOCS, Contract usage guide (frontend/backend)
- A developer guide: for each template (`Account`, `Obligation`, `TreasuryPolicy`,
  `NetPosition`, `NettingCycle`) show how the app reads/writes it via the JSON Ledger API
  endpoints we actually use (create, exercise, active-contracts), with the exact templateId
  forms (G1), Decimal-as-string (G2), and actAs rules, keyed to the functions in
  `lib/ledger-server.ts`. No new SDK; document the endpoints in use.
- **Done when:** a frontend/backend dev can call any contract from the guide alone.

### T23 · P1 · DAML, Pre-cycle funding check (defaulter pays)
Real-world basis: CLS pay-in-before-settle and the CCP defaulter-pays principle (see
`docs/SETTLEMENT_DESIGN.md` §1). Today `Account.ensure balance >= 0` only catches an underfunded
payer at `Settle`. Add a check that refuses to open or settle a cycle until every projected net
payer's account covers its net, so it fails fast before committing.
- **Done when:** a Script shows an underfunded payer is rejected before `Settle`, with a clear reason,
  and a funded set still settles.

### T24 · P1 · DAML, Auto drop-and-re-net survivors
Real-world basis: CLS rescinds a failed member and re-nets survivors; Lamfalussy Standard IV
(`docs/SETTLEMENT_DESIGN.md` §2). `NettingCycle` already takes explicit `participants` and
`obligationCids`, so re-netting a solvent subset is a new cycle. Automate: exclude the underfunded
payer, recompute nets over the remainder, settle the survivors; the defaulter's obligations stay open.
**Never unwind a settled batch** (finality; §3).
- **Done when:** a Script shows one underfunded payer excluded and the remaining parties settle
  cleanly, with the excluded party's obligations still open.

### T25 · P2 · DAML, Partial settlement / gridlock resolution
Real-world basis: CHIPS balanced-release and multilateral offsetting (`docs/SETTLEMENT_DESIGN.md` §4).
When the full set cannot clear, settle the largest solvent subset instead of failing everyone. Keep
all-or-nothing atomicity per settled subset.
- **Done when:** a Script shows a partial (subset) settlement completing atomically when the full
  set cannot.

### T26 · P1 · DOCS, Settlement design (research-grounded)
- ✅ `docs/SETTLEMENT_DESIGN.md`: the market-accepted hybrid (netting + atomic finality +
  defaulter-pays prefunding + drop-and-re-net + legal finality), each decision tied to a cited
  precedent (BIS, CLS, CPMI-IOSCO, CHIPS, Canton, Fnality). Sets the honest positioning (Cash token
  is a placeholder; operator-blind MPC/ZK and legal finality are named as future, not claimed).

---

## Deferred, explicitly OUT of the must-have cut
Pull these in only if the whole spine is live with time to spare.
- Real **Scan API** dashboard (keep it mocked, it already looks right).
- Real **USDCx / Circle xReserve** (we use the `Cash` token; USDCx is the deck story).
- **NL-query** + **reconciliation** agents.
- **Multi-currency** netting; **tokenized-invoice** financing.

## Parking lot / open items
- **Deadline set: 13 Jul** (Mon 13 Jul 12:59 BST).
- Confirm the **OIDC token flow** per party (T02), biggest frontend unknown.
- Confirm whether a shared/hosted USDCx test token exists on 5N Sandbox (else Cash token).
