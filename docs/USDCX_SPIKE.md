# T33 Spike: Can NetChain settle in real USDCx via CIP-56 before 13 Jul?

Investigation only. No code, contracts, or other files changed. See `docs/SETTLEMENT_DESIGN.md`
(design decision 5, "Settlement asset") and `NetChain_Settlement_Design_Report.md` (funding-model
and build-order sections) for why this question matters: NetChain settles its own placeholder
`Account.balance`, not a credible settlement asset.

## 1. What CIP-56 actually specifies

CIP-56 ("Canton Improvement Proposal 56") is the Canton Network token standard: a set of uniform
Daml interfaces so wallets and apps can hold and move any tokenized asset without depending on a
specific registry's implementation. Primary source: the CIP text itself,
[canton-foundation/cips, cip-0056.md](https://github.com/canton-foundation/cips/blob/main/cip-0056/cip-0056.md),
plus the reference implementation in
[hyperledger-labs/splice, `token-standard/`](https://github.com/hyperledger-labs/splice/tree/main/token-standard),
and the explainer at
[canton.network/blog: What is CIP-56?](https://www.canton.network/blog/what-is-cip-56-a-guide-to-cantons-token-standard).

It defines six interface families: token metadata, holdings, transfer instructions, and three
allocation interfaces (`AllocationRequest`, `AllocationInstruction`, `Allocation`) that together
give atomic delivery-vs-payment:

1. An app that needs assets delivered (an exchange, or in our case a `NettingCycle`) creates an
   `AllocationRequest` asking a party to lock funds.
2. The party's wallet calls `AllocationInstruction` against its `Holding` to create an
   `Allocation`, which locks tokens until a deadline.
3. The settlement app watches for all required `Allocation`s to appear, then submits one
   transaction that exercises the transfers atomically. If a deadline passes without full
   allocation, the lock releases automatically and nothing moves.

This is structurally the same "pre-fund then atomic all-or-nothing" pattern already described in
`SETTLEMENT_DESIGN.md` decision 1 (CLS pay-in) and used in `NetChain_Settlement_Design_Report.md`'s
recommended Phase 3 ("each net payer must allocate their USDCx holdings ... using CIP-56's
Allocation API"). Confirmed against Digital Asset's own docs:
[Token Standard Integration (registry-user-guide)](https://docs.digitalasset.com/utilities/devnet/overview/registry-user-guide/token-standard.html)
and [Splice Token Standard APIs](https://docs.global.canton.network.sync.global/app_dev/token_standard/index.html).

## 2. What USDCx is

USDCx is a USD-denominated stablecoin on Canton, minted 1:1 against USDC deposited through
Circle's **xReserve** bridge (not a wrapped/derivative token issued by a third party: Circle is
the registrar). It launched on Canton **Mainnet on 4 December 2025**, the first blockchain
integration of xReserve. Sources:
[Circle: USDCx on Canton now available via Circle xReserve](https://www.circle.com/blog/usdcx-on-canton-now-available-via-circle-xreserve),
[canton.network/blog: USDCx Now Live on Canton](https://www.canton.network/blog/usdcx-now-live-on-canton-unlocking-private-and-composable-usdc-backed-settlement),
[Circle xReserve deposit quickstart](https://developers.circle.com/xreserve/tutorials/deposit-usdc-on-ethereum-for-usdcx-on-canton).
CoinGecko lists it as `xreserve-bridged-usdc-canton`, consistent with the "bridged USDC" framing
in the task brief. Circulating supply tracked live at
[usdc.cool/canton](https://usdc.cool/canton) (~$3.5M bridged as of the sources gathered here, a
real but still small pool, not deep liquidity).

Onboarding a party to actually hold USDCx (per
[Noves: The Onboarding Lifecycle for a Registry Token on Canton](https://noves.fi/blog/canton-usdcx-tracking))
is a four-stage process: upload the Utility DAR bundle, sign a `TransferPreapproval` scoped to
Circle's admin party, complete Circle's KYC/compliance flow to receive on-chain credentials, then
query balances. This is a real-money, compliance-gated onboarding, not a one-line integration.

**Devnet vs Mainnet: unresolved by documentation, resolved partially by probing (below).** No
page found states outright "USDCx is live on DevNet" or "TestNet." Every USDCx-specific page
(Circle's blog, canton.network's blog, Digital Asset's `usdc/xreserve/mainnet-technical-setup.html`,
and the page literally path-named `.../devnet/usdcx-support/`) documents **MainNet and TestNet**
environment variables only, with no DevNet party IDs or endpoints appearing anywhere, despite one
of the docs pages living under a `/devnet/` URL path (that path segment appears to be Digital
Asset's general docs-site naming, not a claim of DevNet deployment). TestNet itself requires GSF
Tokenomics Committee approval via sync.global, granted only "within two weeks of production
readiness," meaning it is not something we could self-serve onto before 13 Jul either.

## 3. Probe result: our 5N validator (read-only)

Fetched an M2M token from `${TOKEN_ENDPOINT}` and called `GET ${BASE}/v2/packages` and
`GET ${BASE}/v2/state/ledger-end` (no writes, no exercises, secret/token never printed).

- `GET /v2/state/ledger-end` → 200, ledger is live and advancing (offset returned).
- `GET /v2/packages` → 200, **602 package IDs** vetted on our participant.

Cross-referenced those 602 IDs (exact hash match, not name match; `/v2/packages` returns content
hashes, not names) against two authoritative package-ID lists:

- Splice repo's pinned lock file,
  [`hyperledger-labs/splice/daml/dars.lock`](https://github.com/hyperledger-labs/splice/blob/main/daml/dars.lock),
  which lists the CIP-56 token-standard packages (`splice-api-token-allocation-v1/v2`,
  `-allocation-instruction-v1/v2`, `-allocation-request-v1/v2`, `-holding-v1/v2`, `-metadata-v1`,
  `-transfer-instruction-v1/v2`, `-transfer-events-v2`, `-burn-mint-v1`, `-token-standard-utils`,
  plus test-only packages). **14 of 21 listed package IDs matched exactly**, including every
  non-test package: both allocation, allocation-instruction, allocation-request, holding, and
  transfer-instruction versions, plus metadata-v1, burn-mint-v1, transfer-events-v2, and
  token-standard-utils. The 7 that did not match are all test-harness packages
  (`splice-test-token-v1/v2[-test]`, `splice-token-standard-v1-test/v2-test`), which is expected
  since a production/devnet participant has no reason to vet Splice's own test fixtures.
- Digital Asset's published
  [DAR Package Versions](https://docs.digitalasset.com/utilities/devnet/reference/dar-versions/dar-versions.html)
  for the Utility Registry framework that backs registry tokens like USDCx
  (`utility-registry-v0`, `utility-registry-app-v0`, `utility-registry-holding-v0`,
  `utility-credential-v0`, `utility-credential-app-v0`, `utility-commercials-v0`, three published
  versions each, 17 IDs total). **17 of 17 matched exactly.**

**Conclusion of the probe:** the CIP-56 Allocation/Holding/Transfer-Instruction/Metadata interface
packages, and the full Utility Registry framework that USDCx is built on, are vetted on our 5N
validator right now. That is a genuinely positive, verified signal, not a guess.

**What the probe does NOT show**, because it was deliberately read-only and package-vetting is
necessarily silent on this: whether Circle's actual USDCx registry contract (registrar = Circle's
`instrumentAdmin` party) is instantiated and reachable from our participant/synchronizer; whether
our M2M identity or any of our four devnet parties (`NETCHAIN_OPERATOR/COMPANY_A/B/C`) has
completed Circle's `TransferPreapproval` + KYC step; whether we hold, or could mint, any USDCx at
all; and whether our synchronizer is the same one Circle's registry uses (`SETTLEMENT_DESIGN.md`
decision 7 already flags that Canton atomic composability requires a shared synchronizer). None of
this can be answered by listing package IDs: it requires either creating/querying real contracts
(out of scope for a read-only probe) or asking Digital Asset/Circle directly.

## 4. What would have to change in `daml/daml/NetChain.daml`

Today: `Account` (`daml/daml/NetChain.daml:14-22`) is an **operator-issued Decimal balance**,
signed by the operator, observed by the owner, and not a token holding at all. `Settle`
(`NetChain.daml:138-165`) directly archives and recreates `Account` contracts, mutating
`balance` in one atomic transaction. There is no `Cash` template; "Cash" in the design docs is an
informal name for this Decimal.

Wiring real USDCx via CIP-56 would require, at minimum:
1. Replace `Account.balance : Decimal` with real CIP-56 `Holding` interface views over USDCx
   instrument IDs (`splice-api-token-holding-v1/v2`, already vetted per §3); the token would be
   owned directly by each party's wallet, not held by the operator.
2. Each net payer creates an `AllocationInstruction` against their Holding, locking their net-debit
   amount for the cycle (this is the CLS-pay-in-equivalent step `NetChain_Settlement_Design_Report.md`
   already recommends as Phase 3, "Pre-Settlement Funding Check").
3. `Settle` changes from directly archiving/recreating `Account` to exercising the `Allocation`
   interface's execute/transfer choice across all confirmed allocations: still one atomic
   transaction, but now composing with Circle's registry package instead of our own template.
4. Every participating party (operator + companies) needs a genuine USDCx holding, which means
   Circle's KYC/`TransferPreapproval` onboarding (§2) completed for each, and real USDC bridged in
   via xReserve to mint it: a multi-day, real-money, compliance-gated process outside our control.
5. Confirming our 5N validator's synchronizer matches wherever Circle's USDCx registry actually
   lives, which is unverified in this spike (§3).

## 5. Go / no-go for 13 Jul

**No-go for real USDCx settlement before the hackathon deadline.** The CIP-56 interfaces are
mechanically ready on our validator (verified), but real USDCx requires Circle-side KYC,
`TransferPreapproval`, and an actual USDC deposit through xReserve per party, none of which is a
same-day, self-serve action, and none of which was in scope for a read-only spike. There is also no
documented DevNet deployment of USDCx to target even if onboarding were instant; TestNet access is
gated behind GSF Tokenomics Committee approval reserved for near-production apps.

**Recommendation:** keep USDCx as the documented future settlement asset exactly as
`SETTLEMENT_DESIGN.md` decision 5 and `NetChain_Settlement_Design_Report.md`'s Should-Have item 7
already do ("USDCx deposit/withdraw via xReserve, real money rails," explicitly Post-Hackathon,
not Must-Have). Do not claim USDCx is wired for the demo. If there is appetite to show forward
progress before 13 Jul, the safe, honest increment is a **shape-only change**: restructure
`Account`/`Settle` to mirror the CIP-56 `Holding`/`Allocation` interface shapes (still
operator-issued, still our own instrument, no real Circle registry involved) so the eventual swap
to real USDCx is a registry-pointer change rather than a data-model rewrite. Label it clearly
as a preparatory refactor, not real stablecoin settlement.

## Sources

- CIP-56 spec: https://github.com/canton-foundation/cips/blob/main/cip-0056/cip-0056.md
- Splice token-standard reference implementation: https://github.com/hyperledger-labs/splice/tree/main/token-standard
- Splice DAR lock file (package IDs): https://github.com/hyperledger-labs/splice/blob/main/daml/dars.lock
- Splice Token Standard APIs docs: https://docs.global.canton.network.sync.global/app_dev/token_standard/index.html
- canton.network: What is CIP-56? https://www.canton.network/blog/what-is-cip-56-a-guide-to-cantons-token-standard
- Digital Asset: Token Standard Integration (registry user guide) https://docs.digitalasset.com/utilities/devnet/overview/registry-user-guide/token-standard.html
- Digital Asset: DAR Package Versions (Utility Registry) https://docs.digitalasset.com/utilities/devnet/reference/dar-versions/dar-versions.html
- Digital Asset: USDCx Support for Wallets https://docs.digitalasset.com/integrate/devnet/usdcx-support/index.html
- Digital Asset: MainNet Technical Setup (xReserve) https://docs.digitalasset.com/usdc/xreserve/mainnet-technical-setup.html
- Circle: USDCx on Canton now available via Circle xReserve https://www.circle.com/blog/usdcx-on-canton-now-available-via-circle-xreserve
- Circle xReserve deposit quickstart https://developers.circle.com/xreserve/tutorials/deposit-usdc-on-ethereum-for-usdcx-on-canton
- canton.network: USDCx Now Live on Canton https://www.canton.network/blog/usdcx-now-live-on-canton-unlocking-private-and-composable-usdc-backed-settlement
- usdc.cool Canton circulating-supply dashboard https://usdc.cool/canton
- Noves: The Onboarding Lifecycle for a Registry Token on Canton (USDCx) https://noves.fi/blog/canton-usdcx-tracking
- CertiK: CIP-56 Redefining Token Standards for Institutional DeFi https://www.certik.com/resources/blog/cip-56-redefining-token-standards-for-institutional-defi

**Unverified / not established by this spike** (flagged explicitly, not implied): whether Circle's
USDCx registry contract is reachable from our specific 5N validator/synchronizer; whether any
DevNet or TestNet deployment of USDCx exists at all; exact current circulating-supply figure
(sourced secondary dashboard, not a primary Circle number at time of writing).
