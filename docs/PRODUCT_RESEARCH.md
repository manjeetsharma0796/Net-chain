# NetChain Product Research: Demand, Competition, and Architecture Fit

This report is decision-oriented: it does not repeat the settlement-mechanics research already done in
`docs/SETTLEMENT_DESIGN.md` and `NetChain_Settlement_Design_Report.md`, and it assumes the architecture
described in `docs/ARCHITECTURE.md` and `README.md` (operator-visible netting, `Cash`/`Account` model,
atomic `Settle`, per-party privacy via Canton, no legal-finality wrapper, USDCx named as the future
settlement asset). It asks a narrower question: does a real buyer want this, who else sells it, and what
is genuinely missing before a real treasury would adopt it. Every non-obvious claim below is cited; where
a claim could not be verified against a primary or credible secondary source it is marked "unverified."

---

## 1. Target buyer and real pain points

### Who buys this

The buyer is not "crypto." It is corporate treasury and shared-service-center functions at multinationals
with many subsidiaries, running (or wanting to run) an in-house-bank / netting-center model. This is a
mature category: multilateral netting has been in commercial use for "over 50 years" [1].

- **Netting-center operators inside MNCs**, a group treasury center, shared-service center, or head
  office acting as the hub. Example buyer profile from DBS: CFOs, treasurers, finance directors, chief
  accounting officers, and procurement leaders at multinationals in automotive, energy, financial
  services, technology, and logistics [1].
- **Named, verifiable adopters**: Wahl Clipper (personal-care manufacturer) stood up two netting centers
  after a Kyriba implementation to centralize FX trading and settlement [2]. Bandwidth cut the notional
  amount of its cross-currency trades 90% via netting and eliminated hundreds of manual journal entries
  [3]. Nestlé and ABB are named Coprocess clients, ABB nets 270+ subsidiaries and 50,000+ invoices twice
  monthly [4]. Société Générale used Broadridge's Canton-based Distributed Ledger Repo (DLR) platform for
  intercompany/intracompany repo netting across three business units, intercompany trades were ~40% of
  its transaction volume, and took out close to $1M/year moving off spreadsheets [5]. Wizz Air became
  J.P. Morgan's first client for cashless, invoice-by-invoice "virtual netting" of multicurrency
  intercompany exposures on J.P. Morgan's VAM infrastructure [6].
- **Banks build competing in-house-bank infrastructure for the same buyer**: J.P. Morgan's Virtual
  Account Management (VAM) has deployed 100+ virtual-account solutions supporting thousands of virtual
  accounts per client [7]; SAP's In-House Cash (IHC) module lets a corporate header entity act as its own
  in-house bank with virtual/current accounts per subsidiary [8].

### Their real, stated pain points

- **Cost**: unnetted intercompany payments create "unnecessary costs in terms of bank fees, foreign
  exchange spreads, and lost float," plus fraud/error risk from decentralized processing; netting
  consolidates monthly intercompany payments down to roughly one per entity per month [1].
- **FX cost and volume**: vendor-reported ranges (Kyriba, GTreasury/Coprocess) claim netting cuts cross-
  border payment volume by up to 70% and, for hedging specifically, related FX trade costs by up to 75%
  [9][10], vendor marketing claims, not independently audited, read as directional ("vendor-claimed"),
  not academic figures. The one independently citable, non-vendor number in this category is CLS's: its
  multilateral netting plus payment-versus-payment (PvP) model cuts each member's actual funding
  requirement by roughly 96% versus gross settlement [11], the clearest quantified proof that netting's
  liquidity benefit is real and large, even though CLS itself is bank-only wholesale FX, not a corporate
  netting-center product (see §2).
- **Audit and tax/compliance risk**: AFP's own guidance to treasurers lists a "robust, auditable tool"
  for intercompany payables, reducing tax and audit risk, as a top reason to adopt multilateral netting,
  alongside reduced bank fees and reduced FX volume [12]. This is a compliance-driven buy, not just a
  cost play.
- **Manual, fragmented process today**: Wahl Clipper's pre-netting pain was "no visibility into FX
  exposures/fees, decentralized regional FX processes, manual/disconnected settlement, limited
  transparency on execution costs and bank fees" [2]. J.P. Morgan frames the same problem for Wizz Air:
  unmanaged intercompany FX/transaction fees "can add up to millions of dollars a year for large global
  enterprises" [6].
- **General treasury bandwidth context** (not netting-specific, but frames the buyer's overall agenda):
  62% of treasury professionals cite cash/liquidity forecasting as their most challenging task (2025 AFP
  Treasury Benchmarking Survey); cash management and forecasting are the top priority for 73% of
  practitioners [13]. A netting/settlement product competes for attention against this backdrop, it must
  save treasury time, not add an operational burden.

### Buying criteria (what makes a product adoptable, not just useful)

- **ERP/TMS integration is table stakes**, not a differentiator: Kyriba states over 1,000 of its clients
  run SAP as ERP with Kyriba as TMS, connected via a SAP-certified REST/OAuth2 integration for both ECC
  and S/4HANA [14]. SAP itself has no true out-of-the-box multilateral netting engine as a core module -
  most SAP-native netting is built via In-House Cash plus custom configuration or a third-party netting
  connector over RFC [15][8]. Either way, a netting product that cannot post journal entries to the
  general ledger and sync bank-account/counterparty master data is a non-starter for this buyer.
- **Works over existing bank rails, does not require new ones.** This is the single most load-bearing
  fact for NetChain's differentiation (see §3): Coprocess (GTreasury's netting engine, the category
  leader, ~175 clients [4]) nets intercompany invoices to one amount per subsidiary/currency, then
  generates PAY/RECEIVE (cash) or DEBIT/CREDIT (in-house-bank) *instruction files*, typically ISO 20022
  over SFTP, for a bank or TMS to execute [16]. SAP's In-House Cash settles the same way: the in-house
  cash centre issues FINSTA IDoc statements over ALE/EDI, each subsidiary clears its own IHC account the
  next business day, and real money movement to/from external banks still rides SAP Multi-Bank
  Connectivity (SWIFT, EBICS, host-to-host) [17][18]. **None of these netting engines move money
  themselves**, they calculate and instruct; a bank, in-house-bank ledger, or TMS executes on its own
  schedule, decoupled from the netting calculation.
- **Audit trail and tax documentation**: intercompany netting must produce records that support arm's-
  length transfer-pricing positions. The OECD BEPS Action 13 three-tier standard (Master File, Local
  File, Country-by-Country Report) is the global documentation bar tax authorities test against [19], and
  intercompany agreements must match actual conduct or a tax authority can re-characterize the
  transaction [19]. A netting system's output needs to be able to feed this, not just settle cash.
- **Legal enforceability of the netting arrangement itself**: bilateral master netting agreements are
  broadly enforceable across G-10 jurisdictions when properly documented and opinioned, but this requires
  a real legal agreement, not just a software feature, "neither IECA nor legal counsel can guarantee
  enforceability for every situation" [20]. This is a legal artifact NetChain does not produce or model
  today.
- **Compliance screening is assumed, not optional**: any entity moving payment instructions for a bank is
  expected to run OFAC/sanctions screening in real time before execution; delayed screening is itself a
  violation even if no match is found [21]. NetChain's `Settle` has no sanctions/KYC gate today.
- **Accounting-treatment friction is real for DLT-settled instruments specifically**: under current IFRS,
  a corporate's holding of a bank-issued stablecoin is typically classified as an intangible asset, not a
  cash equivalent, which affects how a treasurer can report it on the balance sheet (IASB reviewing this)
  [22] (moderate confidence, surfaced via secondary coverage of Deutsche Bank flow research, recommend
  re-verifying before using as a load-bearing claim in external-facing material). This is a concrete
  reason a treasury buyer would hesitate on "settling in a token," independent of Canton's technical merits.

### Market size (treat as a range, not a number)

Estimates vary 2-6x by scope (core TMS vs. broader treasury-management-services vs. cloud-only), and no
single primary/government source was found, so these are vendor/analyst estimates, presented as a range:
global Treasury Management System market estimates cluster between roughly $6.4-6.6B (2025/2026) growing
to $16-17.5B by 2032-2035 across three independent research firms (Polaris Market Research [23], MarkWide
Research [24], Coherent Market Insights [25]). The single most concrete data point is a real transaction,
not a research estimate: **Ripple's $1B acquisition of GTreasury** (announced 16 Oct 2025; GTreasury
serves 400+ customers processing roughly $12.5-13T in annual payment volume), explicitly framed by Ripple
as the entry ticket to "the multi-trillion-dollar corporate treasury market" [26], see §2, this is also
the most important new competitive signal.

### DLT-specific demand signals (real, not speculative)

- **Ripple acquired GTreasury for $1B and, in Jan 2026, shipped "the first treasury management system
  with native digital asset capabilities,"** combining GTreasury/Coprocess netting with Ripple's XRP
  Ledger / RLUSD stablecoin rails, prime brokerage (Hidden Road) access, and tokenized money-market funds
  [26][27]. This is the single strongest piece of evidence that a major DLT player believes corporate
  treasury/netting is the wedge into blockchain settlement, but see §2 for why it is not the same product
  as NetChain (no confirmed atomic settlement, no confirmed per-party confidentiality of net positions).
- **J.P. Morgan Kinexys** (formerly Onyx) has processed over $1.5T cumulative volume since 2020, reportedly
  exceeding $5B/day by December 2025, across cross-border payment settlement, intraday repo/DvP, and a
  Tokenized Collateral Network [28][29]; Wizz Air is a named, live intercompany-"virtual netting" customer
  on J.P. Morgan's adjacent VAM/payments infrastructure [6].
- **The strongest single corroborating signal for Canton-native privacy specifically**: Digital Asset and
  Kinexys (J.P. Morgan) announced in January 2026 the intention to bring JPM Coin (JPMD) natively to
  Canton Network, phased through 2026 [30]. Trade press frames this as J.P. Morgan adopting privacy and
  compliance capabilities that its own existing rails (the permissioned Kinexys chain, and JPM Coin's
  November 2025 debut as a deposit token on the public Base network) do not provide today [31][32], i.e.,
  even a bank running one of the most mature institutional DLT settlement stacks in production is treating
  Canton's sub-transaction privacy as additive, not already available, in its own infrastructure.
- **Broadridge's DLR (on Canton)** is the strongest existing evidence that Canton specifically can carry
  large confidential institutional settlement volume in production, not pilot: ~$280B average daily repo
  volume in August 2025, rising to $339B/day in September 2025, up roughly 490% year-over-year [33][34].
  This is repo, not multilateral netting, but it proves the privacy-at-scale claim NetChain is relying on.
- **Broadridge's own "DLT in the Real World" survey**: 36% of respondents report active DLT initiatives,
  50% of North American firms run live DLT/digital-asset projects (up 72% YoY), 85% cite intraday
  liquidity and 79% cite transaction-cost reduction as the key DLT payoff [35].
- **Deloitte's 2Q2025 CFO Signals survey** (200 North American CFOs, ≥$1B revenue): 23% expect their
  treasury to use crypto for investment or payments within two years, rising to ~40% at $10B+ revenue
  firms; only 1% rule out ever using crypto for business functions [36].
- **No public evidence was found of any named treasury team or netting-center operator using Canton/Daml
  specifically for intercompany netting or in-house banking, and no Canton ecosystem material uses the
  phrase "confidential multilateral netting."** Canton's institutional traction so far is
  securities/repo/collateral (Broadridge DLR, HQLAx, GS DAP, the DTCC Treasuries-tokenization pilot
  targeted for 2H 2026) [37][38], not the netting-center use case. This is a genuine gap in current
  evidence: NetChain would be an early or first mover in applying Canton to this specific workflow, which
  cuts both ways, no direct precedent to point to, but also no incumbent already occupying it.

---

## 2. Competitive landscape

Every incumbent researched falls into one of two camps: **netting incumbents** compute multilateral net
positions but settle over conventional, non-atomic rails; **DLT-native settlement players** settle
atomically on a ledger but do so bilaterally (or among a handful of named counterparties), without
confidential N-party net-position computation. No researched product occupies the intersection of both.

| Player | Category | What it actually does | Settlement / privacy model | Where NetChain differs |
|---|---|---|---|---|
| **Kyriba** (own multilateral netting module + In-House Banking) | Incumbent TMS + netting | Full netting-cycle workflow (open cycle → import invoices/preliminary FX → resolve disputes → release payments → close cycle); 1,000+ SAP-integrated clients [14][39] | Netting triggers In-House Banking (IHB) entries (POBO/ROBO) or, where local entities can't settle on IHB accounts (Mexico, Taiwan, Singapore, China), falls back to a physical bank payment [39]. Confidentiality is conventional cloud security (ISO 27001, SOC 1/2/3), not cryptographic [40]. | NetChain settles the net legs itself, atomically, in one Daml transaction; Kyriba's netting calculation and its money movement are always two separate steps. |
| **Coprocess** (owned by GTreasury, **not** Kyriba, acquired by GTreasury in 2021 [41]) | Incumbent netting-category leader | ~175 clients netting millions of invoices/year; Nestlé and ABB (270+ subsidiaries, 50,000+ invoices twice monthly) are named clients [4] | Generates PAY/RECEIVE (cash) or DEBIT/CREDIT (non-cash) settlement instructions, ISO 20022 XML for bank upload or TMS import, an instruction file, not a money movement [16] | Same gap: compute-then-instruct, not atomic settlement; privacy is centralized-database access control. |
| **SAP Treasury / In-House Cash (IHC) / Multilateral Netting** | Incumbent ERP-native | S/4HANA documents a netting capability in Treasury/FSCM; IHC lets a corporate act as its own in-house bank (virtual accounts, cash pooling, POBO) [8][15] | Batch, message-based: the IHC centre issues FINSTA IDoc statements over ALE/EDI; each subsidiary clears its IHC account, often the next business day; real bank movement rides SAP Multi-Bank Connectivity (SWIFT, EBICS, host-to-host) [17][18] | No SAP source describes one atomic all-or-nothing settlement transaction, or Canton-style sub-transaction privacy; confidentiality is ERP database role-based access and company-code segregation. |
| **J.P. Morgan VAM (Virtual Account Management)** | Bank-native in-house banking | Virtual sub-ledgers layered on one physical DDA; 100+ deployments; markets "virtual netting", settling invoices one-by-one via a virtual account per currency instead of running a netting cycle [7][6] | All fund movement occurs on the single underlying physical account; virtual accounts are a reporting/allocation layer, not independent ledger entries. Confidentiality is bank access-control/reporting permissions. | VAM's netting alternative still requires the corporate to be inside one bank's proprietary account structure; NetChain is issuer-neutral, protocol-level privacy across independent parties. |
| **J.P. Morgan Kinexys** (formerly Onyx) | DLT-native institutional settlement | $1.5T+ cumulative volume since 2020, ~$5B+/day by Dec 2025; live cross-border payments, intraday repo/DvP, Tokenized Collateral Network; JPM Coin (JPMD) live as a deposit token on public Base since Nov 2025 [28][29][42] | "Permissioned participation" privacy, full ledger visibility among vetted counterparties, not Canton-style sub-transaction privacy where non-involved parties can't see a transaction exists [43]. No source describes Kinexys doing confidential multilateral netting across many parties; every production use case is bilateral or few-party. **Jan 2026: Digital Asset + Kinexys announced intent to bring JPMD natively to Canton**, framed by trade press as JPM adopting privacy its own rails lack [30][31][32]. | NetChain's per-party privacy is a ledger-protocol property available today, on the same network JPM itself is moving toward for that property, not a single bank's internal permissioning. |
| **CLS / CLSSettlement / CLSNet** | Wholesale FX netting + PvP settlement | CLSSettlement: multilateral net then true payment-versus-payment settlement, 18 currencies, ~$7T+ average daily value (2021 peak $15.4T), ~50% of global FX volume by 2022; cuts each member's funding requirement ~96% vs. gross [11][44]. **CLSNet** (2018, built with IBM on Hyperledger Fabric) is a separate, *bilateral* payment-netting product for 120+ non-CLS-eligible currencies, live with Goldman Sachs and Morgan Stanley [45][46]. | CLSSettlement funds via scheduled central-bank-money pay-in/pay-out per member, not one atomic cross-party transaction; CLS Bank is the trusted central operator, so confidentiality is conventional access control, not cryptography. Corporates cannot be direct members (~75 bank Settlement Members; 35,000+ Third Parties access only via a sponsor) [47][48]. CLSNet nets bilaterally, then still settles elsewhere. | CLS is the closest real precedent for "operator sees the graph, members don't see each other" plus real settlement-risk elimination, but it is centralized (not a shared ledger), bank-only (not corporate intercompany), and non-atomic (scheduled RTGS pay-in/pay-out, not a single transaction). Its own DLT product (CLSNet) is bilateral, not multilateral. |
| **GTreasury** (Coprocess's owner, now Ripple-owned) / **Ripple Treasury** | Incumbent TMS+netting, now fused with a DLT/stablecoin rail | GT Netting cuts FX conversion volume up to 70% (vendor claim) [9]; 400+ customers, ~$12.5-13T annual payment volume [26]. Jan 2026: shipped "the first TMS with native digital asset capabilities", GTreasury/Coprocess netting plus RLUSD stablecoin rails (3-5 second cross-border transfers), Hidden Road prime-brokerage/repo access, tokenized money-market fund yield [26][27]. | No confirmed atomic settlement of the netted legs and no confirmed per-party confidentiality of net positions in any public material found, announcements describe speed and yield, not privacy or atomicity [27]. | The single most important near-term competitive threat: a well-funded, credible vendor fusing the exact netting category with blockchain settlement. NetChain's argument must be specific, "confidential N-party netting with atomic settlement", not generic "netting on a blockchain," because Ripple/GTreasury will plausibly claim the latter too. |
| **TIS (Treasury Intelligence Solutions)** | Incumbent payments-hub SaaS | Cloud Payments Hub connecting 11,000+ banks via SWIFT/API/host-to-host/EBICS/SFTP; 39,000+ platform users [49][50] | **Has no multilateral/intercompany netting product**, its module list (Payments Hub, Cash Visibility, Intelligence & AI) contains no netting capability, unlike GTreasury's GT Netting [51]. It orchestrates payment instructions to banks over conventional rails. | Not a direct netting competitor at all; included because it is a major treasury-payments incumbent a buyer may already run alongside a netting tool, any NetChain go-to-market should expect TIS-equivalent bank connectivity to already be in place, not need replacing. |
| **Partior** | Wholesale multi-bank DLT settlement | Live production network (J.P. Morgan, DBS, Temasek, Standard Chartered) for tokenized-commercial-bank-money real-time cross-border/domestic payments in USD/EUR/SGD; Deutsche Bank completed its first live euro transaction via Partior with DBS in 2025 [52][53]. Joined OSTTRA/Baton Systems' FX PvP network in 2024. | Atomic bilateral PvP settlement (both legs settle or neither). Where "netting" appears (via OSTTRA/Baton), it is **external, bilateral counterparty-pair matching ahead of gross atomic settlement**, not confidential N-party net-position computation on Partior's own ledger [54][55]. | Different buyer (banks settling with each other) and no confidential multilateral netting; nearest DLT analogue for "atomic settlement of tokenized money," not a netting-center competitor. |
| **Fnality** | Tokenized central-bank-money payment system | Sterling Fnality Payment System live, HM-Treasury-designated (Aug 2022), the world's first regulated DLT wholesale payment system; settles via an Omnibus Account at the Bank of England [56]. | Atomic bilateral peer-to-peer DvP/PvP transfer of tokenized central-bank money; no confidential multilateral netting engine, atomic settlement by design does not compress obligations the way netting does [57]. | Shows what real legal-finality designation looks like, the piece NetChain explicitly lacks and names as future work, but is not a netting-center product. |
| **Broadridge DLR (on Canton)** | DLT-native repo, in production | ~$280-339B average daily repo volume (Aug-Sep 2025), up ~490% YoY; used by Société Générale for intercompany repo netting [5][33][34] | Bilateral repo agreement/execution/simultaneous cash-and-securities settlement per trade; privacy described only generically as "privacy and data segregation built in" via Canton, not as a netting feature [58]. | Proves Canton sub-transaction privacy and atomic DvP work at large institutional scale, the strongest infrastructure proof point for NetChain's claims, but it is bilateral repo, not confidential multilateral netting of arbitrary trade obligations. |
| **HQLAx** | DLT-native securities-lending collateral | Atomic Delivery-versus-Delivery (DvD) collateral swaps (security-for-security, no cash leg); first live transaction 2018 (Credit Suisse/ING); surpassed €1B notional outstanding; only now migrating to Canton after a 2025 Series C-1 investment from Broadridge and Digital Asset [59][60][61] | Explicitly "bilateral trading without a central counterparty" [61], named-counterparty pairs, not multilateral net positions. | Same pattern as Partior/Fnality: real atomic DLT settlement, but bilateral, not confidential N-party netting. |

### Differentiation verdict

No researched competitor combines (a) **confidential per-party net positions**, an operator that sees
the full obligation graph while counterparties stay blind to each other's positions, with (b) **atomic,
all-or-nothing settlement of every net leg inside the same ledger transaction**. The market splits cleanly
into two camps that each hold only half of this:

- **Netting incumbents** (Kyriba, Coprocess/GTreasury, SAP IHC, J.P. Morgan VAM, CLS) compute multilateral
  net positions, then settle over conventional, non-atomic rails (SWIFT/ACH/wire/EBICS/host-to-host, or
  CLS's own central-bank-money pay-in/pay-out schedule), the calculation and the money movement are
  always decoupled, and confidentiality is conventional database/bank access control [16][17][39][47].
  CLS is the closest real-world precedent for "operator sees the graph, members don't see each other,"
  and it independently proves netting's liquidity benefit is real (~96% funding reduction versus gross
  settlement [11]), but CLS is a centralized bank operator, not a shared ledger with sub-transaction
  privacy, and corporates cannot even be direct members [47].
- **DLT-native settlement players** (Partior, Fnality, Broadridge DLR, HQLAx, J.P. Morgan Kinexys) do
  atomic settlement on a ledger, but bilaterally or among a handful of named counterparties (PvP swaps,
  DvP repo, DvD collateral swaps). Where any netting appears (Baton/OSTTRA alongside Partior), it is
  external, bilateral, counterparty-pair netting, not confidential on-ledger N-way netting [54][55].
- Canton's sub-transaction privacy is a real, differentiated substrate, participants see only the parts
  of a transaction relevant to their role [43], but every Canton application found (Broadridge DLR,
  HQLAx, GS DAP) packages it for bilateral repo/collateral/securities settlement, not a confidential
  N-party netting cycle. **No Canton or Digital Asset material found uses the phrase "confidential
  multilateral netting"; this appears to be original framing, not an existing industry label.**
- The clearest corroborating signal that this combination is treated as new, not commodity, capability:
  J.P. Morgan, already running one of the most mature institutional DLT settlement stacks in production
  (Kinexys), is bringing JPM Coin to Canton specifically for privacy/compliance properties its own
  permissioned and public-L2 rails do not provide [30][31][32].

**This combination is real and defensible, but it is a protocol-level property, not yet a product moat.**
Ripple/GTreasury is the one competitor plausibly capable of copying the "netting + blockchain settlement"
positioning soon, given its capital and installed base [26][27]; nothing in its public materials as of
this research claims per-party confidentiality of net positions or atomic settlement of the netted legs.
NetChain's differentiation should therefore be argued specifically, "confidential N-party netting with
atomic settlement on Canton", not generically as "netting on a blockchain."

Two honest caveats on the verdict itself: (1) the "no one combines both" conclusion rests substantially on
absence of evidence in vendor/press materials, not on an explicit competitor disclaimer, treat it as
well-supported, not certain. (2) The underlying economic value of netting (compressing gross obligations,
saving liquidity) is well-precedented and effectively commoditized (CLS ~96%, Coprocess/GTreasury ~70%
vendor-claimed); NetChain's novelty is in *how* it delivers settlement and privacy, not in the netting
concept itself.

---

## 3. Architecture fit and gaps

Grounded in the current implementation (`daml/daml/NetChain.daml`, `docs/ARCHITECTURE.md`) and the
research above: three things are genuinely differentiated today, and a longer list is table stakes a real
treasury buyer already assumes any serious product has.

### What is genuinely differentiated
1. **Canton sub-transaction privacy enforced at the data layer**, not the UI, a `NetPosition` literally
   has only that party (and the operator) as observer, so a counterparty's read is a real `404`, not a
   masked field [ARCHITECTURE.md]. No incumbent netting product researched (Kyriba, Coprocess, SAP IHC,
   VAM, CLS) offers this; their privacy model is conventional database/bank access control [16][17][40].
2. **Atomic multi-party settlement of the netted legs as one ledger transaction.** Every netting incumbent
   researched separates "compute the net" from "move the money" [16][17][39]; NetChain's `Settle` choice
   moves every leg or none, in the same commit that also asserts the on-ledger `TreasuryPolicy` cap. Even
   the DLT-native settlement players that do get atomicity (Partior, Kinexys, HQLAx) do it bilaterally,
   not across a confidential N-party net [54][43][61].
3. **On-ledger, non-bypassable policy enforcement** (`TreasuryPolicy.maxSettlementPerCycle`,
   `requiresHumanApprovalAbove`) that a rogue or AI-driven agent cannot exceed by construction, verified
   live on Devnet (250k rejected, 150k accepted) [README.md, ARCHITECTURE.md].

### What is table stakes (real treasuries assume it; NetChain does not have it yet)
Prioritized by how directly each gates real adoption, each tied to the cited demand/competitive research
above, not speculative:

1. **ERP/TMS integration path.** Every real buyer already runs SAP, Oracle, or a TMS like Kyriba/GTreasury
   and expects bidirectional GL posting and master-data sync [14]. NetChain today has no ERP connector or
   even an export format, the single largest gap versus "would a treasury actually plug this in."
   *Concrete next step:* one ISO 20022 or CSV export of settled legs (mirrors Coprocess's own PAY/RECEIVE
   output format [16]) so NetChain's atomic settlement can feed an existing TMS/GL, instead of requiring
   the buyer to replace their TMS.
2. **Audit-trail and tax-documentation output.** AFP names "a robust, auditable tool" as a top adoption
   driver [12], and OECD BEPS Action 13's Master/Local/Country-by-Country File structure is the real
   compliance bar for intercompany positions [19]. NetChain's ledger already has an immutable settlement
   record (the `updateId`/transaction id shown today [README.md]); the gap is a reporting view mapping
   settled net legs back to the underlying `Obligation`s per counterparty, per period, what an auditor or
   tax authority would actually ask for.
3. **Sanctions/compliance screening gate before `Settle`.** Real-time OFAC/sanctions screening before
   execution is a baseline requirement anywhere payment instructions leave the building [21]; NetChain's
   `Settle` has no such check today. This is a small, concrete Daml addition (an assertion, or an
   off-ledger pre-check gating the exercise) consistent with the existing `TreasuryPolicy` assertion
   pattern already in the codebase.
4. **Pre-cycle funding check and drop-and-re-net for a defaulting payer.** Already scoped and marked done
   per `docs/SETTLEMENT_DESIGN.md` §1-2 and `TASKS.md` T23/T24; flagged here only to confirm it is *also*
   a real-demand item, not just settlement theory, it is the direct analogue of what CLS does when a
   member fails to pay in, and CLS's ~96% funding-reduction number [11] is exactly the liquidity benefit
   this protects.
5. **Settlement-asset story: move off the demo `Cash` token toward USDCx or a tokenized deposit.** USDCx
   (Circle's xReserve-backed, CIP-56 token) went live on Canton in December 2025, explicitly described as
   enabling private and composable settlement across Canton apps with need-to-know visibility [62][63].
   This is the credible production path already named in `TASKS.md` (T33) and `docs/SETTLEMENT_DESIGN.md`
   §5; this research confirms USDCx specifically is no longer hypothetical, it is live [62]. It only
   partially answers the "IFRS treats stablecoins as intangible assets" hesitation [22], that is an
   accounting-treatment question about the instrument, not the ledger, so the settlement-asset story
   should still be pitched as "tokenized deposit / regulated stablecoin," not "this behaves like cash today."
6. **A real (even minimal) netting/legal agreement artifact.** Master netting agreements are broadly
   enforceable across G-10 jurisdictions but require actual legal documentation and, ideally, a legal
   opinion [20]; a Daml `TreasuryPolicy`-style contract that each party signs, referencing an off-ledger
   netting agreement id, would connect the technical settlement to something a lawyer or auditor can point
   to. This is cheap to add (a text field/hash reference) and closes a real, cited gap without inventing
   legal-finality machinery NetChain cannot actually provide (per `docs/SETTLEMENT_DESIGN.md` §3, legal
   finality requires statutory designation like the EU SFD, explicitly out of scope).
7. **Position NetChain against Ripple/GTreasury explicitly, not just against DLT abstractly.** Given
   Ripple's $1B acquisition of the netting category leader and its Jan 2026 "TMS with native digital asset
   capabilities" launch [26][27], the credible near-term competitive risk is not "blockchain vs. no
   blockchain," it is "confidential atomic netting on Canton vs. netting-plus-stablecoin-rail on XRP
   Ledger." Positioning materials (deck, README) should name this comparison directly: Ripple's public
   materials do not claim per-party confidentiality of net positions or atomic settlement of the netted
   legs, that is NetChain's argument, and it should be made explicitly, reinforced by the fact that J.P.
   Morgan itself is moving toward Canton for the privacy property Kinexys lacks [30][31][32].

### Explicitly not recommended right now
Operator-blind (MPC/ZK) netting remains research-only with a documented scalability ceiling
(`docs/SETTLEMENT_DESIGN.md` §6, citing BIS/Zama and BIS Project Aurum), and no real buyer in this research
asked for it, every real netting-center operator model researched (Kyriba, SAP, DBS, J.P. Morgan, CLS)
assumes the operator sees the graph [1][39][47]. Legal-finality designation (EU SFD-equivalent) is a
multi-year regulatory undertaking, correctly named as out of scope rather than attempted. Building either
now would be scope creep against demand that does not exist yet.

---

## 4. 2026 regulatory and competitive update

Facts that post-date the landscape above, each tied to a NetChain implication.

- **ISO 20022 MX is now mandatory, not a migration.** The SWIFT MT/MX coexistence period ended
  2025-11-22; cross-border instructions must be exchanged in ISO 20022 MX (CBPR+) or risk rejection,
  with unstructured addresses barred from November 2026 [64]. Implication: the settled-leg export must
  be pain.001-shaped to be ingestible by a real bank/TMS. Now built (T59); a generic CSV alone would
  not clear.
- **GENIUS Act (signed 2025-07-18) creates a real settlement-asset category.** It defines "permitted
  payment stablecoin issuers" (PPSIs) with 1:1 reserves and Fed/OCC supervision; the OCC's 2026
  rulemaking would let a national-trust-chartered PPSI settle in central-bank money [65][66].
  Implication: the Cash-token placeholder now has a specific, nameable regulated target (a PPSI stablecoin
  or tokenized deposit), not just "USDCx someday."
- **Operator-blind netting now has a funded builder.** Cycles Protocol (Cosmos co-founder; roughly $8.7M
  raised, Coinbase Ventures among backers) is building TEE plus ZK multilateral clearing that removes the
  trusted-operator-sees-all assumption [67]. Implication: track it as the named competitive risk on the
  confidentiality axis, as Ripple/GTreasury is named on the netting axis. NetChain's Canton-native
  per-party privacy is defensible for now but no longer uncontested research.
- **A named legal-netting standard exists.** UNIDROIT's Principles on the Operation of Close-out Netting
  Provisions (2013; roughly 26 states plus the EU) give the missing "netting agreement artifact" a real
  standard to reference by name instead of a generic legal-opinion placeholder [68].
- **The "same production network" proof point is stronger.** DTCC's tokenization pilot (SEC no-action
  Dec 2025) reached limited live production on Canton in July 2026 (tokenized Russell 1000, ETFs, US
  Treasuries; 50-plus firms including BlackRock, Goldman, JPMorgan, Circle); Canton overall cites roughly
  700 institutions and about $9T/month settled [69][70]. Implication: refresh deck proof points from
  Broadridge-only to the DTCC/Canton July-2026 figures.
- **Traceability is baseline.** SWIFT gpi carries a UETR that lets any party trace a payment end to end
  [71]; NetChain has an on-ledger updateId but no portable cross-institution reference. Worth a
  UETR-style field (tracked as T61).
- **Design caution: strategic under-funding.** A 2026 study of Canada's high-value payment system finds
  banks rationally engineer gridlock to save liquidity [72]; a rational NetChain participant could
  deliberately under-fund to force a cheaper re-net rather than genuinely default. Worth a design note on
  the pre-cycle funding check.

Confidence caveats: the Cycles Protocol figures are from its own whitepaper and press coverage (not
independently audited); the Garratt/Lu/Tian applicability to an operator-run corporate netting cycle is
an inference from a bank-RTGS setting, offered as a design caution, not a proven equivalence.

---

## Sources

1. DBS Corporate Banking, "Benefits of Multilateral Payment Netting." https://www.dbs.com.sg/corporate/insights/multilateral-payment-netting
2. Kyriba, "Wahl Clipper: Multilateral Netting Trims Significant FX Costs." https://www.kyriba.com/resource/wahl-clipper-multilateral-netting-trims-fx-costs/
3. Kyriba, "FX Risk Management Strategies and Multilateral Netting." https://www.kyriba.com/blog/multilateral-netting-approaches-to-fx-risk-management/
4. GTreasury (GlobeNewswire), "GTreasury Acquires Coprocess, the Leader in Intercompany Netting Solutions"; Coprocess, "Nestlé's Intercompany Netting Solution." https://www.globenewswire.com/en/news-release/2021/03/02/2185077/0/en/GTreasury-Acquires-Coprocess-the-Leader-in-Intercompany-Netting-Solutions.html ; https://www.coprocess.com/~coproces/clients/client-case-study/455-nestle-s-intercompany-netting-solution.html
5. Broadridge, "Global Investment Bank Reinvents Intracompany Repo Trades with DLR" (Société Générale case study). https://www.broadridge.com/case-study/capital-markets/global-investment-bank-reinvents-intracompany-repo-trades-with-dlr
6. J.P. Morgan, "Wizz Air Streamlines Multicurrency Settlements With Virtual Netting"; J.P. Morgan, "FX exposure netting solutions." https://www.jpmorgan.com/payments/newsroom/wizz-air-multicurrency-virtual-netting ; https://www.jpmorgan.com/insights/treasury/liquidity-management/fx-exposure-netting-risk-management-solutions
7. J.P. Morgan, "Virtual Account Management (VAM)." https://www.jpmorgan.com/payments/solutions/treasury/virtual-account-management
8. SAP Press, "Comparing In-House Banking and SAP In-House Cash"; Zanders, "Managing Virtual Accounts using SAP In-House Cash." https://blog.sap-press.com/comparing-in-house-banking-and-sap-in-house-cash ; https://zandersgroup.com/en/insights/blog/managing-virtual-accounts-using-sap-in-house-cash
9. GTreasury/Ripple Treasury, "Netting" product card. https://treasury.ripple.com/posts/netting-product-card
10. Kyriba, "FX Risk Management Strategies and Multilateral Netting" (75% figure). https://www.kyriba.com/blog/multilateral-netting-approaches-to-fx-risk-management/
11. CLS Group, "CLSSettlement." https://www.cls-group.com/products/settlement/clssettlement/
12. AFP, "5 Reasons Why Treasurers Should Adopt Multilateral Netting." https://www.financialprofessionals.org/training-resources/resources/articles/Details/5-reasons-why-treasurers-should-adopt-multilateral-netting
13. AFP, "2025 AFP Treasury Benchmarking Survey Report." https://www.financialprofessionals.org/training-resources/resources/survey-research-economic-data/Details/treasury-benchmarking
14. Kyriba, "Kyriba SAP Integration: Best ERP-to-Bank Gateway for Finance." https://www.kyriba.com/resource/partnership-brief-kyriba-sap-integration/
15. Coprocess, "Intercompany Netting FAQs." https://www.coprocess.com/faq.html
16. Coprocess, "How Intercompany Netting Works With Your In-House Bank." https://www.coprocess.com/coprocess-blog/553-how-intercompany-netting-works-with-your-in-house-bank.html
17. SAP Support KBA 3319204, "In-house Cash Process Overview." https://userapps.support.sap.com/sap/support/knowledge/en/3319204
18. Treasury Management International, "SAP & SWIFTNet for Treasury & Payment Efficiency." https://treasury-management.com/articles/sap-swiftnet-for-treasury-payment-efficiency
19. IRS, "Transfer Pricing Documentation Best Practices FAQs"; Deloitte, "Managing intercompany: Navigating new challenges and tax complexities." https://www.irs.gov/businesses/international-businesses/transfer-pricing-documentation-best-practices-frequently-asked-questions-faqs ; https://www.deloitte.com/us/en/programs/center-for-controllership/blogs/managing-intercompany-accounting-challenges-and-tax-complexities.html
20. International Energy Credit Association, "Master Netting Agreement & Enforceability Opinion." https://ieca.net/master-netting-agreement-enforceability-opinion/
21. Industry-standard OFAC/BSA-AML practice: Federal Reserve/OCC/FDIC examination guidance requires real-time sanctions screening of payment instructions before execution (representative source: FDIC, "Bank Secrecy Act / Anti-Money Laundering"). https://www.fdic.gov/banker-resource-center/bank-secrecy-act-anti-money-laundering-bsaaml
22. Deutsche Bank flow research on stablecoin accounting treatment (IFRS intangible-asset classification), surfaced via secondary coverage; **recommend re-verifying directly against flow.db.com before citing externally.** https://flow.db.com/topics/cash-management/stablecoins-between-vision-and-reality
23. Polaris Market Research, "Treasury Management System Market Size Worth $16.10 Billion By 2032." https://www.polarismarketresearch.com/press-releases/treasury-management-system-market
24. MarkWide Research, "Global Treasury Management System (TMS) Market ... Forecast 2026-2036." https://markwideresearch.com/global-treasury-management-system-tms-market
25. Coherent Market Insights, "Treasury Management Market Size, Share & Forecast, 2025-2032." https://www.coherentmarketinsights.com/market-insight/treasury-management-market-6115
26. Business Wire / Ripple, "Ripple Breaks Into Corporate Treasury With $1B GTreasury Acquisition." https://www.businesswire.com/news/home/20251016697362/en/Ripple-Breaks-Into-Corporate-Treasury-With-$1B-GTreasury-Acquisition
27. CoinDesk, "XRP-linked Ripple rolls out treasury platform after $1 billion GTreasury deal." https://www.coindesk.com/business/2026/01/30/xrp-linked-ripple-rolls-out-treasury-platform-after-usd1-billion-gtreasury-deal
28. CoinDesk, "JPMorgan Renames Blockchain Platform to Kinexys." https://www.coindesk.com/business/2024/11/06/jpmorgan-renames-blockchain-platform-to-kynexis-to-add-on-chain-fx-settlement-for-usd-eur
29. J.P. Morgan, "Blockchain brings collateral mobility" (Kinexys Digital Assets). https://www.jpmorgan.com/insights/payments/blockchain-digital-assets/blockchain-kinexys-asset-tokenization
30. PR Newswire, "Digital Asset and Kinexys by J.P. Morgan Announce Intention to Bring USD JPM Coin (JPMD) Natively to the Canton Network." https://www.prnewswire.com/news-releases/digital-asset-and-kinexys-by-jp-morgan-announce-intention-to-bring-usd-jpm-coin-jpmd-natively-to-the-canton-network-302654967.html
31. CoinDesk, "JPMorgan's Kinexys to bring digital cash to Canton." https://www.coindesk.com/tech/2026/01/07/jpmorgan-to-issue-its-jpm-stablecoin-directly-on-privacy-focused-canton-network
32. Ledger Insights, "JP Morgan to bring JPM Coin deposit token to Canton Network." https://www.ledgerinsights.com/jp-morgan-to-bring-jpm-coin-deposit-token-to-canton-network/
33. Broadridge, "Broadridge Distributed Ledger Repo Platform [hits US$339bn September average daily volume]." https://www.broadridge.com/press-release/2025/broadridge-distributed-ledger-repo-platform-september
34. Broadridge, "Billions in average daily processed trade volumes on Broadridge DLT repo platform." https://www.broadridge.com/press-release/2025/billions-in-average-daily-processed-trade-volumes-on-broadridge-dlt-repo-platform
35. Broadridge, "Digital Asset Adoption Accelerates Alongside Distributed Ledger Technology Implementation." https://www.broadridge.com/press-release/2025/digital-asset-adoption-accelerates-alongside-dlt-implementation
36. Deloitte, "2Q2025 CFO Signals Survey." https://www.deloitte.com/us/en/insights/topics/business-strategy-growth/2q-2025-cfo-signals-survey.html
37. Canton Network, "DTCC and Digital Asset Partner to Tokenize DTC-Custodied U.S. Treasury Securities on the Canton Network." https://www.canton.network/canton-network-press-releases/dtcc-and-digital-asset-partner-to-tokenize-dtc-custodied-u.s.-treasury-securities-on-the-canton-network
38. BlockEden, "Canton Network overview" (Goldman Sachs GS DAP on Canton). https://blockeden.xyz/blog/2026/01/27/canton-network-jpmorgan-wall-street-privacy-blockchain-institutional-defi/
39. Hyperbots, "What is Kyriba Netting?" https://www.hyperbots.com/glossary/kyriba-netting
40. Kyriba, "Trust Center" (security/compliance certifications). https://www.kyriba.com/use-cases/security/
41. GTreasury (GlobeNewswire), "GTreasury Acquires Coprocess, the Leader in Intercompany Netting Solutions." https://www.globenewswire.com/en/news-release/2021/03/02/2185077/0/en/GTreasury-Acquires-Coprocess-the-Leader-in-Intercompany-Netting-Solutions.html
42. J.P. Morgan, "First bank issues USD deposit token on a public blockchain." https://www.jpmorgan.com/payments/newsroom/jpm-coin-usd-deposit-token-institutional-clients
43. Canton Network, "How Canton Network Delivers Institutional-Grade Privacy." https://www.canton.network/blog/how-canton-network-delivers-institutional-grade-privacy
44. Wikipedia, "CLS Group" (peak-day and % of global FX volume figures, cross-checked against CLS Group's own site). https://en.wikipedia.org/wiki/CLS_Group
45. CLS Group, "CLS's DLT payment netting service goes live with Goldman Sachs and Morgan Stanley." https://www.cls-group.com/news/cls-s-dlt-payment-netting-service-goes-live-with-goldman-sachs-and-morgan-stanley/
46. Ledger Insights, "Morgan Stanley, Goldman go live on CLS / IBM FX blockchain." https://www.ledgerinsights.com/morgan-stanley-goldman-cls-blockchain-fx-clsnet/
47. CLS Group, "Settlement Members" / "CLS Membership." https://www.cls-group.com/products/settlement/clssettlement/membership/ ; https://www.cls-group.com/communities/settlement-members/
48. CCIL, "CLS Settlement." https://www.ccilindia.com/web/ccil/cls
49. TIS, "Payments Hub" and "Bank Connectivity." https://tispayments.com/solutions/payments-hub/ ; https://tispayments.com/solutions/payments-hub/bank-connect/
50. TIS, "FAQs" (39,000+ users); Tracxn, "TIS Company Profile" (Marlin Equity Partners acquisition). https://tispayments.com/company/faqs/ ; https://tracxn.com/d/companies/tis/__d7I_LH2194v82LwPRDWC2bUiNCS3CZ7Zar72T8faIog
51. TIS, "Solutions" (module list, no netting product). https://tispayments.com/solutions/
52. Partior, "Our Story"; Partior homepage. https://partior.com/about-us/our-story ; https://partior.com/
53. Deutsche Bank, "Deutsche Bank conducts first euro transaction via Partior's blockchain platform." https://corporates.db.com/more/latest-news/deutsche-bank-conducts-first-euro-transaction-via-partior-s-blockchain-platform
54. Ledger Insights, "Partior DLT settlement system joins OSTTRA's FX PvP platform." https://www.ledgerinsights.com/partior-dlt-settlement-system-joins-osttras-fx-pvp-platform/
55. OSTTRA, "OSTTRA, Baton and Partior Expand FX Settlement." https://osttra.com/press_releases/osttra-baton-partior-fx-settlement-tokenised-commercial-bank-funds/
56. Fnality, "Fnality commences initial phase of Sterling payment operations in a world first"; Fnality, "Omnibus Account." https://fnality.com/news/fnality-commences-initial-phase-of-sterling-payment-operations-in-a-world-first ; https://fnality.com/news/omnibus-account
57. Fnality, "Benefits." https://fnality.com/benefits
58. Digital Asset, "Customer Story: Broadridge." https://blog.digitalasset.com/blog/customer-story-broadridge
59. HQLAX homepage; R3, "Credit Suisse and ING execute first live transaction using HQLAx." https://www.hqla-x.com/ ; https://r3.com/press-media/credit-suisse-and-ing-execute-first-live-transaction-using-hqlax-securities-lending-app-on-r3s-corda-blockchain-platform/
60. HQLAX, "HQLA-X DLT platform surpasses €1bn milestone on DvD securities lending transactions." https://www.hqla-x.com/post/hqla-dlt-platform-surpasses-eu1bn-milestone-on-dvd-securities-lending-transactions
61. HQLAX, "HQLAx Announces Strategic Investments from Broadridge and Digital Asset to Support its Next Phase of Growth on Canton." https://www.hqla-x.com/post/hqlax-announces-strategic-investments-from-broadridge-and-digital-asset-to-support-its-next-phase-of-growth-on-canton
62. Canton Network, "USDCx Now Live on Canton: Unlocking Private and Composable USDC-Backed Settlement." https://www.canton.network/blog/usdcx-now-live-on-canton-unlocking-private-and-composable-usdc-backed-settlement
63. Canton Network, "What is CIP-56? A Guide to Canton's Token Standard." https://www.canton.network/blog/what-is-cip-56-a-guide-to-cantons-token-standard
64. BNY, "Update on ISO 20022 End of Co-Existence" (May 2025); PaymentExpert, "Swift's ISO 20022 cutover: The end of MT and a 20-year promise" (Nov 2025). https://www.bny.com/assets/corporate/documents/pdf/iso-20022-end-of-co-existence_-may-2025-final.pdf ; https://paymentexpert.com/2025/11/21/swifts-iso-20022-cutover-the-end-of-mt-and-a-20-year-promise/
65. Wikipedia, "GENIUS Act"; World Economic Forum, "How will the GENIUS Act work in the US and impact the world?" https://en.wikipedia.org/wiki/GENIUS_Act ; https://www.weforum.org/stories/2025/07/stablecoin-regulation-genius-act/
66. Davis Wright Tremaine, "OCC Proposes Stablecoin Issuer Regulation, Finalizes Rule on National Trust Banks Authority" (Feb 2026). https://www.dwt.com/blogs/financial-services-law-advisor/2026/02/occ-stablecoin-rule-national-trust-banks-powers
67. The Block, "Cosmos co-founder's new multilateral clearing startup Cycles raises $6.4 million"; Cycles, "Respect the Graph, Announcing the Cycles Whitepaper." https://www.theblock.co/post/402176/cosmos-co-founders-new-multilateral-clearing-startup-cycles-raises-6-4-million ; https://cycles.money/blog/cycles-whitepaper
68. UNIDROIT, "Netting" instrument page and "Principles on the Operation of Close-Out Netting Provisions." https://www.unidroit.org/instruments/capital-markets/netting/
69. DTCC, "DTCC Advances Development of New Tokenization Service" (May 2026); Reuters/Yahoo Finance coverage of the July 2026 pilot launch. https://www.dtcc.com/news/2026/may/04/dtcc-advances-development-of-new-tokenization-service ; https://finance.yahoo.com/markets/stocks/articles/dtcc-tokenize-russell-1000-stocks-161215488.html
70. Genfinity, "Inside the Canton Network: Infrastructure for Real-Time, Tokenized Institutional Finance" (Jan 2026). https://genfinity.io/2026/01/29/canton-network-institutional-blockchain-overview/
71. Swift, "Swift gpi" product page. https://www.swift.com/products/swift-gpi
72. Garratt, Lu, Tian, "How Banks Create Gridlock in Payment Systems to Save Liquidity: The Case of Canada," Journal of Money, Credit and Banking (2026). https://onlinelibrary.wiley.com/doi/10.1111/jmcb.70013

**Not independently re-verified in this pass (flagged inline as unverified/moderate confidence):** the
exact real-time sanctions-screening citation (source 21 is representative industry guidance, not a single
authoritative primary text specific to netting centers); the IFRS stablecoin-as-intangible-asset detail
(source 22); whether individual CLS members can see each other's net positions (no source explicitly
confirms or denies this, the design implies each member receives only its own pay-in schedule, but this
is inference, not a stated fact); all vendor-claimed percentage figures (70%, 75%, 90% reductions from
Kyriba/GTreasury/Coprocess marketing) are vendor claims, not independently audited or academically sourced.
