# NetChain Settlement Design (research-grounded)

This document turns how settlement actually works in production into concrete design decisions
for NetChain. Every decision is tied to a cited real-world precedent. Nothing here is aspirational
marketing: where a property is not real yet, it is named as future work, not claimed.

Sources are listed at the end and referenced inline by number.

## The one tradeoff that governs everything

Liquidity efficiency (netting) versus settlement risk (gross or atomic settlement). You can have
atomic gross settlement (zero settlement risk, instant finality, every leg pre-funded) or
netting-driven liquidity efficiency, but not both at once [7][9]. The market verdict, after
decades: nobody runs pure gross-atomic settlement of everything (the intraday liquidity is
prohibitive) and nobody runs pure end-of-day multilateral netting with post-hoc unwind (a single
failure forces a systemic recomputation). Every large-value system is a **hybrid**: net or offset
to save liquidity, deliver real-time finality, and back it with a default procedure and legal
finality [1][2][8]. A peer-reviewed result quantifies the sweet spot: multilateral netting benefit
is essentially intact for a settlement window of one hour or more and is lost only as the window
shrinks toward instantaneous [7].

## Where NetChain sits today (honest)

NetChain does deferred multilateral netting, then one atomic all-or-nothing `Settle` over
operator-held pre-funded accounts, with per-party policy caps. This is structurally close to
CLS (multilateral net, then atomic settlement of the net position) [3]. What it is missing versus
a production system: an enforced pay-in step, an automatic failure procedure, legal finality, and
a credible settlement asset (it settles our own `Cash` token, not central bank or commercial bank
money). Also, the operator can see the full obligation graph (it must, to compute nets);
counterparties are blind to each other, enforced by Canton sub-transaction privacy [10].

## Design decisions, each tied to precedent

### 1. Funding model: enforced pre-funding, defaulter pays
Real systems put the defaulter's own resources first: CLS requires pay-in before pay-out on a
fixed schedule with a positive-balance rule [3]; CCPs consume the defaulter's margin and default
fund before any mutualized resource ("defaulter pays") [4]. NetChain already enforces pre-funding
at the moment of settlement: `Account.ensure balance >= 0` means a net payer cannot go negative, so
an underfunded payer reverts the whole commit. The gap is that this is discovered only at `Settle`.
**Build: a pre-cycle funding check** that refuses to open or settle a cycle until every projected
net payer's account covers its net, so it fails fast before committing, mirroring CLS pay-in-before-settle.

### 2. Default handling: drop and re-net the survivors, never unwind after finality
This is the crux. CLS does not unwind trades already settled; on a member's pay-in failure it
recalculates survivors' positions, rescinds the failing member's unsettled instructions (pushed
back to bilateral settlement), and completes the rest using in/out swaps and standing liquidity
providers, sized to survive the single largest obligor [3]. The Lamfalussy minimum standard IV
requires a netting system to complete settlement even if the participant with the largest single
net-debit position fails [5]. NetChain's `NettingCycle` already takes an explicit `participants`
and `obligationCids` list, so re-netting a solvent subset is simply a new cycle.
**Build: automatic exclude-and-re-net.** Detect the underfunded payer, recompute nets over the
remaining solvent parties, settle the survivors; the defaulter's obligations stay open for the next
cycle or bilateral handling. **Hard rule from the research: only ever unwind BEFORE finality.** Never
reverse a settled batch. CHIPS abandoned end-of-day-net-with-unwind in 2001 precisely because
post-hoc unwind is systemically dangerous [8], and the EU Settlement Finality Directive exists to
block retroactive unwinding of a completed netting [6].

### 3. Finality: irrevocable at Settle, and technical finality is not legal finality
NetChain's `Settle` is atomic and, once committed on Canton, irrevocable. That is correct at the
technical level. The honest gap: technical irreversibility is not legal settlement finality, which
requires statutory designation (EU SFD 98/26/EC, UK Settlement Finality Regulations) [6]. Fnality
is the precedent that got a live system designated in the UK [10]. For a hackathon this is out of
scope, but it is the real productionization gap and must be named, not implied. Design rule: do not
build any feature that unwinds a settled cycle.

### 4. Liquidity saving and gridlock: netting is already the mechanism; partial settlement is the extension
Production RTGS systems bolt offsetting engines onto gross settlement to reclaim netting's liquidity
efficiency while keeping per-payment finality: CHIPS balanced-release reaches roughly 26 dollars of
settled value per 1 dollar of prefunding [8], CHAPS' LSM cut intraday liquidity about 20 percent [1].
Gridlock is defined as enough liquidity to settle simultaneously by netting but not enough to settle
sequentially [2]. NetChain's multilateral netting IS this liquidity-saving mechanism already.
**Optional build (phase 2): partial settlement.** When the full set cannot clear, settle the largest
solvent subset (a gridlock-resolution move: simulated-net-balance / offsetting [2]) rather than
failing everyone. Keep all-or-nothing atomicity per settled subset.

### 5. Settlement asset: `Cash` is a placeholder; do not claim a stablecoin is cash
Central bank money is the gold standard settlement asset and is what Fnality uses (tokenized central
bank money via a Bank of England omnibus account) [10]. The pragmatic production path is tokenized
commercial bank deposits (Partior, JPMorgan Kinexys) [10]. Stablecoins can break the singleness of
money and carry issuer credit risk (BIS documents depegs around SVB and FTX); central banks steer
wholesale settlement toward central bank money or non-bearer tokenized deposits, which transfer at
par [11]. **Positioning rule:** NetChain's `Cash` token is a demo instrument; the honest production
story is settlement in a regulated tokenized deposit or, ideally, central bank money, not a claim
that a stablecoin equals cash.

### 6. Privacy: operator-visible today, operator-blind is future and honestly hard
Counterparty privacy (companies blind to each other) is real and Canton-enforced, and Canton
sub-transaction privacy is in live production (Broadridge DLR processes its full repo volume on
Canton) [10]. Operator-blind netting, where even the operator cannot see positions (MPC or ZK), is
NOT in production anywhere. The clearest documented ceiling: an ECB and Zama experiment "kept up with
Finland" but not the euro area, and BIS frames the privacy-versus-performance tradeoff as unresolved
[9]. **Rule:** keep the operator-visible model, and name MPC/ZK operator-blind netting as future work
with the cited scalability ceiling, never as a current property.

### 7. Atomic composability caveat (Canton-specific)
Canton's cross-app atomic DvP is real only when every party to the transaction shares a common
synchronizer; absent a shared synchronizer link the touted atomicity does not compose [10]. NetChain's
single-operator model keeps everyone on one synchronizer, so atomicity holds today. If NetChain later
settles against a separate cash or asset app, all parties must share a synchronizer or use the Global
Synchronizer as common ground.

## Build order

Phase 1 (buildable now, high value, closes the honest gaps):
1. Pre-cycle funding check (fail fast, defaulter pays) [3][4].
2. Automatic drop-and-re-net for an underfunded payer, survivors settle [3][5].
3. Daml Script tests: insufficient-funds abort, and re-net-of-subset settles cleanly.
4. Finality stance documented: `Settle` is final; there is no unwind of a settled batch [6][8].

Phase 2 (product realism):
5. Partial settlement / gridlock resolution over the largest solvent subset [2][8].
6. Contingent committed-credit backstop model (CCP pattern), documented not necessarily built [4].
7. Settlement-asset story: tokenized-deposit path, not stablecoin-as-cash [11].

Phase 3 (future / research, named not built):
8. Operator-blind netting (MPC or ZK), with the cited scalability ceiling [9].
9. Legal settlement-finality wrapper or designation [6][10].

## Bottom line for the deck

The market-accepted design is a hybrid: multilateral netting for liquidity efficiency, atomic
finality, defaulter-pays prefunding, drop-and-re-net on failure, and legal finality. NetChain already
has multilateral netting, atomic finality, prefunding enforced at settlement, and Canton-enforced
counterparty privacy. The honest, deliverable roadmap is: enforce prefunding pre-cycle, automate
drop-and-re-net, and name (not fake) the legal-finality, central-bank-money, and operator-blind pieces.

## Sources (representative; full lists in the research briefs)

1. BIS CPMI, Real-Time Gross Settlement Systems (1997); Bank of England, CHAPS LSM (2014). https://www.bis.org/cpmi/publ/d22.pdf ; https://www.bankofengland.co.uk/quarterly-bulletin/2014/q2/how-has-the-liquidity-saving-mechanism-reduced-banks-intraday-liquidity-costs-in-chaps
2. BIS CPMI RTGS (1997) gridlock taxonomy; Bech and Soramaki, Gridlock Resolution (2001). https://www.bis.org/cpmi/publ/d22.pdf ; https://www.ssrn.com/abstract=274290
3. BIS, Settlement risk in FX markets and CLS Bank (2002); CLS liquidity brief. https://www.bis.org/publ/qtrpdf/r_qt0212f.pdf
4. CPMI-IOSCO PFMI; LCH default waterfall and management process; CME financial safeguards. https://www.bis.org/cpmi/publ/d101a.pdf ; https://www.lseg.com/content/dam/post-trade/en_us/documents/lch/resources/lch-sa-default-management-process.pdf ; https://www.cmegroup.com/solutions/risk-management/financial-safeguards.html
5. BIS, Report of the Committee on Interbank Netting Schemes (Lamfalussy, 1990), Standard IV. https://www.bis.org/cpmi/publ/d04.htm
6. EU Settlement Finality Directive 98/26/EC (Articles 3, 5, 7). https://eur-lex.europa.eu/eli/dir/1998/26/2019-06-27/eng
7. FRB New York, What Is Atomic Settlement? (2022); McLaughlin, JFMI (2023/24). https://libertystreeteconomics.newyorkfed.org/2022/11/what-is-atomic-settlement/ ; https://www.risk.net/journal-of-financial-market-infrastructures/7958850/the-trade-off-between-shorter-settlement-times-and-multilateral-netting-benefits-in-deferred-net-settlement
8. BIS, The quest for speed in payments (2017); The Clearing House, CHIPS liquidity algorithm (2024). https://www.bis.org/publ/qtrpdf/r_qt1703g.pdf ; https://www.theclearinghouse.org/payment-systems/Articles/2024/04/CHIPS_Liquidity_Algorithm_04-02-2024
9. Atapoor, Smart, Talibi Alaoui, Private Liquidity Matching Using MPC (2022); ECB and Zama liquidity-matching remarks; BIS Project Aurum 2.0. https://eprint.iacr.org/2021/475 ; https://www.bis.org/about/bisih/topics/cbdc/aurum2_0.htm
10. Canton Network technical primer and privacy docs; Broadridge DLR on Canton; Fnality sterling payment system and finality designation. https://www.canton.network/blog/a-technical-primer ; https://blog.digitalasset.com/blog/customer-story-broadridge ; https://fnality.com/news/fnality-commences-initial-phase-of-sterling-payment-operations-in-a-world-first
11. BIS Bulletin 73, singleness of money and stablecoins; ECB Economic Bulletin on central bank money for FMI settlement. https://www.bis.org/publ/bisbull73.pdf ; https://www.ecb.europa.eu/press/economic-bulletin/articles/2024/html/ecb.ebart202308_01~d9a13e1609.en.html
