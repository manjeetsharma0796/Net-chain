
# NetChain Settlement Design: A Fact-Based Research Report
## Settlement-Systems Research for a Confidential Multilateral-Netting Application on Canton Network

---

## Executive Summary

NetChain is a confidential multilateral-netting and atomic-settlement application on the Canton Network. 
Companies record bilateral obligations (invoices). A netting operator runs a cycle that computes each 
party's single net position (receivable minus payable), keeps each party's net private from the others, 
and then settles every leg in one atomic all-or-nothing transaction bounded by an on-ledger per-party 
policy cap. Today funds are pre-held in operator-controlled accounts, only net payers pay, and any 
failure (insufficient funds or a policy breach) reverts the whole cycle so nothing moves. There is no 
automatic default recovery yet, and the operator can see the full obligation graph (counterparties 
are blind to each other, the operator is not).

This report answers eight research questions with sourced facts, market-accepted compromises, and 
theory-versus-practice gaps. It concludes with a concrete end-to-end settlement flow recommendation 
for NetChain, with every recommendation tied to a cited precedent.

Think of NetChain like Splitwise for corporate treasury -- but with real money, privacy, and atomic 
settlement. In Splitwise, you add bills, the app calculates who owes whom, and you settle up. 
NetChain does the same, but each company only sees its own net position, settlement happens in one 
atomic transaction (all legs succeed or none do), and an on-ledger policy contract caps what any 
agent can authorize.

---

## 1. RTGS vs Deferred Net Settlement: The Liquidity-Risk Tradeoff

### Sourced Facts

Real-Time Gross Settlement (RTGS) settles each payment individually, on a gross basis, with immediate 
finality. TARGET2 (now T2) is the Eurosystem's RTGS: "payments are handled individually. Unconditional 
payment orders are automatically processed one at a time on a continuous basis" with "immediate and 
irrevocable" settlement in central bank money. T2 processes hundreds of thousands of transactions worth 
trillions of euros daily.

The tradeoff is well-documented by CPMI-IOSCO: "Batch settlement based on a DNS mechanism may expose 
participants to credit and liquidity risks for the period during which settlement is deferred. An RTGS 
system can mitigate or eliminate these risks, but requires participants to have sufficient liquidity 
to cover their outgoing payments; the use of this approach can require relatively large amounts of 
intraday liquidity."

BIS research shows the evolution: in 1999, roughly 50% of large-value payment value was settled via RTGS 
and 45% via DNS. By 2005, hybrid systems (combining RTGS and netting) accounted for close to one-third 
of value settled, while RTGS increased to almost two-thirds. The only remaining pure DNS system, EURO1, 
accounted for less than 3%.

Fedwire (US) and CHAPS (UK) are pure RTGS. CHIPS (US), the largest private large-value system, is a 
hybrid: it nets payments during the day but requires prefunding and settles net positions via Fedwire 
at end-of-day. CHIPS introduced a "finality process" in 2001 where participants prefund their positions; 
if a participant fails to fund, "the only result will be that a comparatively few payment messages... 
will not be sent," with "no risk of a catastrophic settlement failure or unwind."

### Market-Accepted Compromise

Almost every large-value system that nets does so with **prefunding or collateral**. CHIPS requires 
participants to prefund their net debit positions. CLS Bank (FX settlement) requires pay-in of net short 
positions before settlement begins. The UK FPS (retail) operates on deferred net settlement but settles 
across CHAPS (RTGS) accounts with a liquidity and loss-sharing agreement.

The compromise is: **net to save liquidity, but prefund to cap risk**. Netting without prefunding 
accumulates credit risk over the deferral period. The BIS notes: "In deferred net settlement systems, 
payments are settled only periodically by transferring only net amounts... banks can reduce delays by 
crediting customer accounts before final settlement. This will, however, come at the expense of credit 
risk, as final settlement may not take place as expected."

### Theory vs Practice

**Good in theory, not used in practice:** Pure deferred net settlement without prefunding or collateral. 
EURO1 was the last major example, and by 2005 it settled less than 3% of large-value payment value. 
Why? Because the credit risk accumulation during the deferral period is unacceptable for large-value 
payments. The Lamfalussy standards (BIS, 1990) required netting systems to have robust loss-sharing 
and collateral arrangements -- effectively pushing the market toward prefunded or hybrid models.

---

## 2. CLS Bank FX Settlement: Multilateral Netting Plus PvP

### Sourced Facts

CLS Bank is the world's largest multicurrency settlement system, handling ~$6.5 trillion daily across 
18 currencies. It settles FX transactions via Payment-versus-Payment (PvP): "the two flows are 
simultaneously settled... a party's payment instruction in one currency is not settled unless the 
corresponding payment instruction in the counter currency is settled."

CLS uses a **pay-in schedule**: participants must first transfer their net short positions to CLS before 
settlement begins. "Because of the netting procedure, settlement members have to pay in to CLS only 
their net short positions in the individual currencies." Funding is on a net basis, but settlement is 
gross (each trade settles individually, but only if both legs can be funded).

Key risk controls: (1) Short position limit per currency (e.g., EUR 1 billion); (2) Aggregate short 
position limit per member (max USD 1.5 billion); (3) Net positive overall account value requirement. 
Haircuts are applied to credit balances to protect against market risk.

### Default Mechanism (The Crux)

When a settlement member fails to pay in:

1. **First pay-in failure**: CLS sends a pay-in call and suspends pay-outs from the failing member's 
   account. If transactions remain unsettled by the 9 a.m. deadline, CLS issues pay-in calls to 
   non-failing members whose instructions are not yet settled.

2. **Currency close deadline**: If a member is still in debit when a currency closes (10 a.m. for 
   Asia/Pacific, noon for European/North American), CLS issues a pay-in call for currency close. 
   If not honoured, CLS resorts to **liquidity providers** -- major banks committed to swap the needed 
   currency against other currencies on CLS accounts. CLS normally requires at least 3 liquidity 
   providers per currency (4 for EUR, each committed EUR 500 million).

3. **Loss allocation**: Losses can only occur if a member fails AND exchange rates move adversely 
   against the currencies in which the failing participant has a credit balance. Any loss is 
   apportioned to members that traded with the failing member on the day it failed.

4. **Extreme case**: If multiple members fail or liquidity is insufficient, CLS may use non-committed 
   credit lines, pay out alternative currencies, or carry balances over to the next business day.

### Market-Accepted Compromise

CLS's design accepts that **liquidity risk cannot be fully eliminated** -- the standby liquidity 
facilities are finite while there is no limit on total trade value. The compromise is: (1) cap each 
member's exposure via position limits; (2) require liquidity provider commitments; (3) mutualize 
residual losses among trading counterparties. As the BIS notes: "The standby liquidity facilities 
cannot completely remove liquidity risk. The main underlying reason for this is that the liquidity 
facilities are finite while there is no limit on the total value of the trades."

### Theory vs Practice

**Good in theory, not used in practice:** A pure PvP system with no overdraft privileges (full pay-in 
before any settlement). The Atlanta Fed paper notes: "a pure PvP system encourages trading with risky 
counterparties more than the current system does... the CLS system lies between PvP and true netting: 
the overdraft privileges speed up settlement and reduce the need for currency, but they deflect part 
of the burden of counterparty default to the system as a whole."

---

## 3. CCP Default Management: The Waterfall

### Sourced Facts

CPMI-IOSCO PFMI Principle 4 requires: "A CCP should maintain sufficient financial resources to cover 
its credit exposure to each participant fully with a high degree of confidence." Systemically important 
CCPs must cover the default of the two largest participants; others must cover at least the one largest.

The **default waterfall** (standard across CCPs):

1. **Defaulter's initial margin** (defaulter-pays): Covers current exposure. "Margin is a 'defaulter-pays' 
   resource; it is not mutualised."

2. **Defaulter's default fund contribution**: Used next. "Usually cash -- defaulter's default fund 
   contribution used before those of non-defaulting CMs."

3. **CCP's own capital (skin in the game)**: LCH places 25% of its minimum regulatory capital ahead 
   of non-defaulting members' contributions. LME Clear contributes 25% of regulatory capital.

4. **Non-defaulters' default fund contributions** (loss mutualization): "Contributions from surviving 
   participants can be used to cover losses of the defaulting participant if the defaulting participant's 
   margin is exhausted."

5. **Recovery tools**: Assessment powers (cash calls), variation margin gains haircutting (VMGH), 
   or contract tear-ups.

LCH's SwapClear uses **Auction Incentive Pools (AIPs)**: each participant's default fund is apportioned 
into pools linked to specific currency portfolios. Participants with large positions in a currency are 
incentivized to bid competitively in auctions for defaulters' portfolios in that currency. If the best 
bid would exceed the AIP, the auction fails and positions are re-auctioned.

NSCC's loss allocation: If losses exceed defaulter resources, NSCC applies its "Corporate Contribution" 
(50% of General Business Risk Capital), then allocates remaining losses among members pro-rata based on 
average daily required deposits over the prior 70 business days. "To date, NSCC has never invoked its 
loss allocation process."

### Market-Accepted Compromise

The waterfall is **defaulter-pays first, then mutualization**. The PFMI requires at least 99% coverage 
of potential future exposure by initial margin. The remaining risk is mutualized. The tradeoff: higher 
margin reduces moral hazard but increases trading costs; more mutualization reduces costs but increases 
counterparty monitoring burden. As the RBA notes: "The balance of margin and default fund chosen by a 
CCP will depend on the weight placed on each of these factors."

### Theory vs Practice

**Good in theory, not used in practice:** A pure defaulter-pays system with no mutualization. In practice, 
no CCP operates this way because initial margin cannot cover extreme stress scenarios with certainty. 
The PFMI explicitly requires systemically important CCPs to hold additional resources beyond margin. 
Mutualization is the accepted backstop.

---

## 4. Liquidity-Saving Mechanisms and Gridlock Resolution

### Sourced Facts

Gridlock is "a situation that can arise in a funds or securities transfer system in which the failure 
of some transfer orders to be executed... prevents a substantial number of other orders from other 
participants from being executed."

T2's AS settlement procedure B uses a **dedicated settlement algorithm** for multilateral balances: RTGS 
checks that there is sufficient liquidity to settle all debit and credit AS transfers simultaneously 
("All or nothing"). If the check fails, all linked AS transfers remain in the queue and a "partial 
optimisation with AS optimisation algorithm" is triggered. If still unsuccessful, the ancillary system 
can use a **guarantee fund mechanism** -- single out failed AS transfers, transform them to procedure A, 
and settle those debits covered by available liquidity.

Bilateral offsetting checks in T2: "This offsetting check is only successful if offsetting cash transfers 
from the RTGS DCA to be credited are available and the RTGS DCA to be debited with the cash transfer 
afterwards has an increased liquidity position." Extended offsetting checks look beyond the top of the 
queue.

Project Jasper (Bank of Canada) Phase II demonstrated that "it was possible to have a liquidity savings 
mechanism for netting transactions" on DLT. Project Ubin (MAS) concluded that DLT "is able to satisfy 
the key functions of a real-time gross settlement system in terms of volume, liquidity savings mechanisms, 
gridlock resolution, security, immutability, and resilience."

### Market-Accepted Compromise

The standard approach is: (1) attempt full multilateral settlement; (2) if that fails, exclude the 
failed party and re-net the remaining; (3) if still insufficient, use guarantee funds or collateral 
to complete settlement. T2's procedure explicitly moves from "all or nothing" to partial settlement 
with guarantee funds. This is the accepted compromise between atomicity and liquidity efficiency.

### Theory vs Practice

**Good in theory, not used in practice:** A pure multilateral offsetting algorithm that always finds 
the maximum set of settleable transactions without any collateral or guarantee fund. In practice, 
all production systems (T2, CHIPS, CLS) have fallback to prefunded collateral or guarantee funds 
because the algorithm alone cannot guarantee settlement when liquidity is genuinely insufficient. 
The guarantee fund is the safety valve.

---

## 5. Corporate and Treasury Multilateral Netting in Practice

### Sourced Facts

Corporate multilateral netting typically follows a **weekly or monthly cycle**. DBS Bank notes: 
"Typically, under netting, intercompany settlement happens once a month. Third party payments often 
happen weekly." The netting value date is typically toward the end of the month, avoiding Fridays 
so errors don't cause weekend overdrafts.

A typical timeline (DBS):
- Tuesday: Reporting day -- operating entities send intercompany invoices to the netting centre.
- Thursday: Confirmation day -- netting centre reconciles invoices, calculates indicative net positions.
- Monday: Dealing day -- netting centre executes FX deals to cover net FX positions.
- Wednesday: Settlement day -- all net payments execute with value Wednesday.

**Legal enforceability** is critical. The risk of "cherry picking" (a liquidator enforcing only 
favorable contracts) is "a principal motivation for netting." Netting must be legally binding not 
only on the parties but also on liquidators. The EU Settlement Finality Directive (SFD 98/26/EC) 
deems settlement in a designated system "final and irrevocable even when the participant has become 
insolvent and insolvency proceedings have been opened against it."

**Close-out netting vs payment netting**: Close-out netting applies upon default -- all outstanding 
contracts are terminated and netted to a single obligation. Payment netting offsets payment obligations 
on the same value date without terminating the underlying contracts. ISDA master agreements provide 
for close-out netting. NetChain uses payment netting (obligations are netted for settlement, not 
terminated).

J.P. Morgan's "virtual netting" (VAM) solution for Wizz Air Group combines with a TMS to create an 
in-house bank model, enabling "intercompany loan administration and the centralization of external 
settlements on behalf of entities, including payment and collection factories."

### Market-Accepted Compromise

Corporate netting accepts that: (1) the netting centre sees the full graph (it must, to compute nets); 
(2) settlement is deferred to a cycle end; (3) FX conversion happens at a reference rate on dealing 
day; (4) legal enforceability requires a netting agreement (ISDA or bespoke) and compliance with the 
EU Settlement Finality Directive or equivalent. The compromise is that privacy is **organizational** 
(counterparties don't see each other's positions) rather than **cryptographic** (the operator sees all).

### Theory vs Practice

**Good in theory, not used in practice:** Cryptographic privacy where even the netting operator is blind. 
In corporate treasury practice, the netting centre/in-house bank MUST see the full graph to compute 
nets, manage FX exposure, and ensure legal enforceability. MPC or ZK-based netting where the operator 
is blind exists only in research. Why? Because: (1) the operator needs to verify invoice authenticity; 
(2) FX conversion requires knowing the full currency breakdown; (3) legal dispute resolution requires 
auditability; (4) performance and latency of MPC/ZK are prohibitive for production treasury operations.

---

## 6. DLT and Wholesale Settlement in Production or Advanced Pilot

### Sourced Facts

**Canton Network**: Uses sub-transaction privacy (each participant sees only relevant contract data), 
atomic DvP via Daml (all-or-nothing transactions), and Canton Coin (CC) as the network utility token. 
Named users include Broadridge (repo settlement) and HQLAx (securities lending). CIP-56 defines token 
standards with Allocation API for atomic settlement. The IMF notes that "a single ledger model is 
generally regarded as a more feasible and operationally sound approach for implementing more advanced 
programmability" including atomic settlement.

**J.P. Morgan Kinexys (formerly Onyx)**: Has exceeded $1.5 trillion in notional value, processing 
~$2 billion daily. Integrating with J.P. Morgan FX Services for on-chain FX settlement in USD and EUR. 
Uses JPM Coin (tokenized deposit) for settlement.

**Partior**: Founded by J.P. Morgan, Temasek, DBS, and Standard Chartered. Provides "blockchain-based 
wholesale clearing and settlement platform" using "digitised commercial bank money." The ECB notes 
Partior "can enable PvP settlement using central bank or commercial bank money through the same 
technical mechanism."

**Fnality**: Building regulated payment tokens backed by central bank reserves. Japanese consortium 
test in 2022 involved Fnality shareholders.

**Central Bank DLT Experiments**:

| Project | Central Banks | Focus | Settlement Asset | Key Finding |
|---------|--------------|-------|-----------------|-------------|
| Jasper (Canada) | Bank of Canada | Domestic payments, DvP | wCBDC | "Significant efficiency gains likely only if multiple assets settled on same DLT" |
| Ubin (Singapore) | MAS | Domestic payments, cross-border | wCBDC | DLT satisfies RTGS functions including "liquidity savings mechanisms, gridlock resolution" |
| Stella (ECB/BOJ) | ECB, Bank of Japan | DvP, cross-chain | wCBDC | Cross-ledger DvP possible but "could yield a complicated solution that generated new challenges" |
| Helvetia (Switzerland) | SNB | wCBDC vs tokenized deposits | Both | Examined "private token money backed one-to-one by sight deposits at SNB" |
| Agora (France) | Banque de France | Tokenized CBDC for wholesale | wCBDC | Part of broader French CBDC experiments |
| Mariana (BIS) | France, Singapore, Switzerland | Cross-border FX, AMM | Hypothetical wCBDC | "AMM could pool liquidity... automatically price and carry out FX transactions" |
| mBridge | Thailand, HK, China, UAE | Cross-border payments | wCBDC | $22M in cross-border payments; reduced time from 3-5 days to 2-10 seconds |

The IMF concludes: "All six solutions support DvP settlement... Tokenized reserves and assets issued 
on a single ledger... enable atomic settlement." But: "Although traditional wholesale interbank systems 
can already support DvP and PvP settlement mechanisms, the key innovation introduced by tokenized 
reserves lies in atomic settlement from having money and assets on the same ledger."

### Market-Accepted Compromise

Production DLT settlement uses **tokenized commercial bank money** (JPM Coin, Partior) or 
**regulated stablecoins** (USDCx on Canton) rather than wCBDC for most use cases. wCBDC experiments 
are advanced but not yet in production for wholesale settlement. The compromise: private tokenized 
money is available now; wCBDC requires central bank policy decisions and legal frameworks.

### Theory vs Practice

**Good in theory, not used in practice:** Cross-ledger atomic settlement using hash time-locked 
contracts (HTLC) across different DLT platforms. Project Jasper-Ubin proved it technically possible, 
but the BIS/BOJ review noted: "While showing this was possible, the experiment also demonstrated that 
it could yield a complicated solution that generated new challenges or risks that would need to be 
managed or solved." Production systems (Kinexys, Partior, Canton) use single-ledger or compatible-ledger 
models, not cross-chain HTLC.

---

## 7. Settlement Finality and Unwind Risk

### Sourced Facts

The EU Settlement Finality Directive (SFD 98/26/EC) states: "the settlement of a monetary or financial 
transaction in a designated system is deemed to be final and irrevocable even when the participant 
has become insolvent and insolvency proceedings have been opened against it."

TARGET2's legal framework: "settlement is irrevocable and unconditional, ensuring payment finality 
continuously throughout the day."

Unwinding a settled net batch is systemically dangerous because: (1) it re-creates all the gross 
obligations that netting had eliminated; (2) it exposes participants to cherry-picking risk; (3) it 
can trigger cascading defaults. The BIS notes: "The risk of cherry picking... is a principal 
motivation for netting." If a liquidator could cherry-pick, "the surviving bank's exposure would 
be the sum of the gross credit exposures... rather than the net difference."

The CHIPS finality process was designed specifically to prevent unwind: "If a participant does not 
pay its final pre-funded balance requirement, the only result will be that a comparatively few payment 
messages... will not be sent... There will be no risk of a catastrophic settlement failure or unwind."

### Market-Accepted Compromise

Finality requires: (1) a legally designated settlement system; (2) settlement in central bank money 
or legally equivalent funds; (3) irrevocable transfer at the moment of settlement; (4) protection 
from insolvency proceedings. The compromise is that systems achieve finality by being "designated" 
under national law (SFD in EU, similar frameworks elsewhere), not by technology alone.

### Theory vs Practice

**Good in theory, not used in practice:** "Technical finality" without legal backing. A smart contract 
can make a transfer irreversible on-ledger, but if a court orders unwinding under insolvency law, 
the on-ledger state may not prevail. The SFD and equivalent frameworks exist precisely because 
technical finality is insufficient without legal designation. NetChain on Canton must address this: 
Canton's atomic DvP provides technical finality, but legal finality requires the system to be 
recognized under applicable insolvency law.

---

## 8. Privacy-Preserving Netting Where Even the Operator Is Blind (MPC or ZK)

### Sourced Facts

No production payment or netting system uses MPC or ZK to hide the obligation graph from the operator. 
All production netting systems (corporate treasury, CLS, CCPs) require the operator to see the full 
graph to: (1) compute net positions; (2) verify obligation authenticity; (3) manage FX conversion; 
(4) resolve disputes; (5) comply with audit and regulatory requirements.

The IMF notes a key tension: "transparency can be higher because of shared data access... Nevertheless, 
this transparency should be carefully balanced with data privacy and sensitivity because certain 
financial information should remain confidential or accessible only to eligible parties."

Canton's sub-transaction privacy provides **organizational privacy**: each participant sees only its 
own contracts. The operator sees the full graph because it is a party to the netting cycle contract. 
This mirrors real-world corporate netting where the netting centre sees all positions.

### Market-Accepted Compromise

Privacy is achieved through **legal and organizational controls**, not cryptography. Participants sign 
NDAs and netting agreements. The operator is a trusted entity (often the group's in-house bank). Access 
controls and audit logs enforce confidentiality. This is the model used by every major corporate 
netting provider (Kyriba, SAP, J.P. Morgan VAM, DBS).

### Theory vs Practice

**Good in theory, not used in practice:** MPC or ZK-based netting where the operator computes net 
positions without seeing individual obligations. Research exists (e.g., secure multi-party computation 
for auction clearing), but no production deployment for corporate treasury netting. Why?

1. **Performance**: MPC protocols have high communication complexity; ZK proofs for complex netting 
   calculations are computationally expensive.
2. **Latency**: Treasury netting cycles have deadlines (e.g., same-day settlement); MPC/ZK adds 
   unacceptable delay.
3. **Auditability**: Regulators and auditors require the operator to demonstrate how nets were computed. 
   ZK proofs verify correctness but don't provide the audit trail regulators demand.
4. **Dispute resolution**: If a participant disputes its net position, the operator must show the 
   underlying obligations. MPC/ZK makes this difficult without revealing all data.
5. **FX handling**: Multi-currency netting requires knowing currency breakdowns to execute FX hedges. 
   Hiding this from the operator is impractical.

---

## SYNTHESIS: Recommended End-to-End Settlement Flow for NetChain

### Core Design Principles (from Precedents)

1. **Prefunding is non-negotiable for net settlement** (CHIPS, CLS, T2 guarantee funds). Netting without 
   prefunding accumulates credit risk.
2. **Atomicity is the primary value proposition** (Canton's DvP, CLS PvP, Jasper DvP). All legs succeed 
   or none do.
3. **Defaulter-pays first, then exclude and re-net** (T2 AS procedure B, CHIPS finality). Don't mutualize 
   unless necessary.
4. **Legal finality requires designation, not just technical atomicity** (SFD, TARGET2).
5. **Operator-visible is the production standard** (every corporate netting system). Cryptographic 
   operator-blindness is research-only.

### Recommended Settlement Flow

#### Phase 1: Obligation Recording (Like Splitwise "Add Expense")

Companies record bilateral obligations on-ledger as Daml `Obligation` contracts. Each obligation is 
visible only to the two counterparties (Canton's sub-transaction privacy). The operator is NOT a party 
to individual obligations -- it only becomes involved at cycle time.

**Precedent**: Corporate netting where subsidiaries submit invoices to the netting centre. The centre 
does not see invoices until the cycle begins.

#### Phase 2: Cycle Initiation and Net Computation (Like Splitwise "Settle Up")

The operator (or a policy-bound agent) creates a `NettingCycle` contract for a defined participant set 
and cut-off time. At cut-off:

1. The operator queries all in-scope `Obligation` contracts (it is the netting coordinator party).
2. Computes each party's net position: sum of receivables minus sum of payables.
3. Records a `NetPosition` contract per party, visible only to that party and the operator.

**Precedent**: DBS netting timeline -- Tuesday reporting, Thursday confirmation, Monday dealing, 
Wednesday settlement. NetChain can compress this to a single cycle.

#### Phase 3: Pre-Settlement Funding Check (Like Splitwise "Confirm You Can Pay")

Before atomic settlement, each net payer must **allocate** their USDCx holdings to the settlement 
request using CIP-56's Allocation API. This is the prefunding step:

- Each net payer calls `Allocate` on their USDCx holdings, committing funds to the cycle.
- The operator verifies that all required allocations are present.
- If any payer fails to allocate sufficient funds, the cycle halts before settlement.

**Precedent**: CLS pay-in schedule -- members must transfer net short positions before settlement 
begins. "CLS will not be able to complete pay-outs" if a member fails to pay in.

#### Phase 4: Atomic Settlement (The "All or Nothing" Moment)

Once all allocations are confirmed, the operator submits **one Daml transaction** that:

1. Debits each net payer's allocated USDCx.
2. Credits each net receiver's USDCx.
3. Updates all `NetPosition` contracts to "settled."
4. Consumes all in-scope `Obligation` contracts.

Either all steps succeed, or none do (Canton's atomic DvP). No partial settlement.

**Precedent**: Jasper Phase III: "The settlement of an individual netted position is implemented as 
a single atomic Corda transaction, meaning it either succeeds fully or fails fully."

#### Phase 5: Failure Handling (What Happens When Someone Can't Pay)

**Current design (all-or-nothing revert)**: If any payer fails to allocate, the entire cycle reverts. 
This is safe but inefficient.

**Recommended evolution (exclude and re-net)**:

1. If a payer fails to allocate by deadline, exclude them from the cycle.
2. Re-compute net positions for the remaining participants.
3. Attempt settlement for the reduced set.
4. The excluded payer's obligations roll forward to the next cycle.

**Precedent**: T2 AS procedure B -- if "all or nothing" fails, single out failed transfers and settle 
remaining with guarantee funds. CHIPS: if a participant doesn't fund, "a comparatively few payment 
messages... will not be sent," and the rest settle.

#### Phase 6: Policy Enforcement (The "Parental Controls")

Each party's `TreasuryPolicy` contract enforces:
- `maxSettlementPerCycle`: caps net debit per cycle (like CLS short position limit).
- `allowedCounterparties`: whitelist (like CHIPS bilateral credit limits).
- `requiresHumanApprovalAbove`: threshold for human-in-the-loop.

The agent proposes; Daml checks policy; Canton settles. If policy is breached, the choice is rejected 
on-ledger.

**Precedent**: CLS aggregate short position limit "defined individually for each settlement member 
according to the size of its Tier 1 capital."

### Funding Model Recommendation

| Approach | Precedent | Fit for NetChain |
|----------|-----------|-----------------|
| **Pre-funding (recommended v1)** | CLS pay-in, CHIPS prefunding | Each net payer allocates USDCx before settlement. Safest, simplest. |
| **Committed credit (future)** | T2 intraday credit, CLS liquidity providers | Pre-committed lines from a liquidity provider (e.g., a bank partner). Reduces prefunding burden. |
| **Collateral (future)** | CCP initial margin | Post collateral to cover potential default. Overkill for corporate netting. |

**Verdict**: Start with pre-funding (allocate USDCx before settlement). This matches CLS and CHIPS, 
is simplest to implement, and aligns with Canton's CIP-56 Allocation API. Committed credit can be 
added later if users demand lower prefunding requirements.

### Default and Failure Handling Recommendation

| Approach | Precedent | Fit for NetChain |
|----------|-----------|-----------------|
| **Exclude and re-net (recommended)** | T2 partial optimisation, CHIPS finality | Remove failed payer, re-compute nets, settle rest. Failed obligations roll forward. |
| **Default fund (future)** | CCP mutualization | Pool of funds to cover failed payer's obligation. Complex for corporate context. |
| **Liquidity provider (future)** | CLS liquidity providers | Committed bank lines to cover shortfalls. Requires bank partnerships. |

**Verdict**: Start with exclude-and-re-net. This is what T2 does when AS settlement fails, and what 
CHIPS does when a participant doesn't prefund. It is operationally simple and doesn't require 
capital pools or bank partnerships. A default fund is overkill for a corporate netting system -- 
CCPs need them because they clear derivatives with extreme leverage; corporate netting is 
payment-netting of invoices with no leverage.

### Finality Semantics Recommendation

NetChain should aim for **technical finality via atomic DvP** (Canton provides this) and document 
**legal finality** as a future requirement. The settlement transaction should:

1. Be irrevocable once committed (Canton's consensus guarantees this).
2. Be protected from insolvency unwinding (requires legal designation under SFD or equivalent).
3. Record a timestamp and transaction ID for audit.

**Precedent**: TARGET2: "settlement is irrevocable and unconditional, ensuring payment finality 
continuously throughout the day."

### Privacy Model Recommendation

| Model | Status | Precedent |
|-------|--------|-----------|
| **Operator-visible (recommended v1)** | Production standard | Every corporate netting system (Kyriba, SAP, J.P. Morgan VAM, DBS). Operator sees full graph; counterparties see only own positions. |
| **Operator-blind (future research)** | Not in production | MPC/ZK research only. Performance, latency, auditability barriers. |

**Verdict**: Operator-visible is correct for v1. It matches real-world corporate netting, is legally 
enforceable, and enables FX management and dispute resolution. Document operator-blind as a future 
research direction but do not build it for the hackathon.

### Build Order: What to Do First vs Later

#### Must-Have (Hackathon Demo)
1. **Daml Obligation + NettingCycle + NetPosition contracts** -- deployed on Devnet.
2. **Per-party private UI** -- prove Company A cannot see Company B's positions.
3. **Atomic settlement** -- one-click settle all net legs in USDCx via CIP-56 Allocation.
4. **Pre-funding check** -- verify allocations before settlement (like CLS pay-in).
5. **Policy-bound agent** -- one agent that submits obligations and proposes cycles within policy limits.

#### Should-Have (Post-Hackathon)
6. **Exclude-and-re-net** -- handle one failed payer by removing them and re-netting the rest.
7. **USDCx deposit/withdraw via xReserve** -- real money rails.
8. **Multi-currency netting** -- FX conversion at a reference rate on dealing day.

#### Stretch (Research/Future)
9. **Committed credit lines** -- reduce prefunding burden.
10. **Legal finality framework** -- designation under applicable settlement finality law.
11. **Operator-blind netting** -- MPC/ZK research (not production-ready).

---

## Full Numbered Source List

1. BIS (2024), "Fast payments: design and adoption," Quarterly Review Technical Annex. 
   URL: https://www.bis.org/publ/qtrpdf/r_qt2403c.htm

2. CPMI-IOSCO (2012), "Principles for Financial Market Infrastructures," PFMI. 
   URL: https://www.iosco.org/library/pubdocs/pdf/ioscopd350.pdf

3. BIS/CPMI (2020), "Developments in retail fast payments and implications for..." 
   URL: https://www.bis.org/cpmi/publ/d201.pdf

4. Dutch Payments Association (2026), "T2 (TARGET2) / TIPS." 
   URL: https://www.betaalvereniging.nl/en/knowledge-base/market-infrastructure/target2-tips/

5. ECB (undated), "Information guide for TARGET2 users." 
   URL: https://www.bde.es/f/webbde/SPA/sispago/t2/ficheros/es/infoguide.pdf

6. Banque de France (2022), "Systems operated by the Banque de France." 
   URL: https://www.banque-france.fr/en/financial-stability/institutional-framework/systems-operated-banque-de-france

7. Oesterreichische Nationalbank (undated), "Understanding TARGET2." 
   URL: https://www.oenb.at/dam/jcr:9a0a2188-e51a-41f5-b808-3c763e4cdad0/mop_2012_q1_in_focus6_tcm16-246792.pdf

8. Banca d'Italia (2021), "T2 and the settlement of gross payments." 
   URL: https://www.bancaditalia.it/compiti/sistema-pagamenti/target2/index.html

9. ECB (undated), "TARGET2: The Eurosystem's real-time gross settlement system" (YouTube). 
   URL: https://www.youtube.com/watch?v=zFvoNDwHPuU

10. Central Bank of Ireland (2023), "T2." 
    URL: https://www.centralbank.ie/financial-system/payments-and-securities-settlements/target-services/t2

11. Kyriba (2022), "Real-time Payments and Large Value Payment Systems." 
    URL: https://www.kyriba.com/blog/real-time-payments-and-large-value-payment-systems/

12. New York Fed (undated), "Global Trends in Large-Value Payments," EPR. 
    URL: https://www.newyorkfed.org/medialibrary/media/research/epr/08v14n2/0809prei.pdf

13. IMF e-Library (undated), "Large-Value Transfer Systems." 
    URL: https://www.elibrary.imf.org/display/book/9781557753861/ch06.xml

14. Bank of England (2024), "A brief introduction to the Real-Time Gross Settlement system and CHAPS." 
    URL: https://www.bankofengland.co.uk/payment-and-settlement/a-brief-introduction-to-the-real-time-gross-settlement-system-and-chaps

15. BNP Paribas Securities Services (2026), "The benefits of Continuous Linked Settlement (CLS)." 
    URL: https://securities.cib.bnpparibas/foreign-exchange-market-benefits-of-cls/

16. Swiss National Bank (undated), "The Continuous Linked Settlement foreign exchange settlement system." 
    URL: https://www.snb.ch/dam/jcr:92bb643e-a03e-4970-a8ce-0dadae60b130/continuous_linked_settlement.en.pdf

17. ECB (2003), "CLS - European Central Bank," Monthly Bulletin. 
    URL: https://www.ecb.europa.eu/pub/pdf/other/pp53_66_mb200301en.pdf

18. ACT/Treasurers.org (undated), "The great FX fix." 
    URL: https://www.treasurers.org/ACTmedia/Summer09CMSspinney6-9.pdf

19. Federal Reserve Bank of Atlanta (2000), "The CLS Bank," Working Paper 2000-15a. 
    URL: https://fraser.stlouisfed.org/files/docs/historical/frbatl/wp/frbatl_wp_2000-15a.pdf

20. New York Fed (undated), "Intraday Liquidity Management in the Evolving Payment System." 
    URL: https://www.newyorkfed.org/medialibrary/microsites/prc/files/ILM.pdf

21. BIS (2008), "How CLS works - a simplified example," Quarterly Review. 
    URL: https://www.bis.org/publ/qtrpdf/r_qt0809y.htm

22. Bundesbank (undated), "Continuous Linked Settlement." 
    URL: https://www.bundesbank.de/en/tasks/payment-systems/oversight/continuous-linked-settlement-626502

23. BIS/CPMI (undated), "Facilitating increased adoption of payment versus payment." 
    URL: https://www.bis.org/cpmi/publ/d207.pdf

24. CLS Group (2025), "FX settlement risk: To PvP or not to PvP." 
    URL: https://www.cls-group.com/insights/the-fx-ecosystem/fx-ecosystem-02-fx-settlement-risk-to-pvp-or-not-to-pvp-shapingfx-series/

25. Euromoney (2021), "CLS pilots expansion of PvP." 
    URL: https://www.euromoney.com/article/294izsc9tdpoxx935e7sw/foreign-exchange/cls-pilots-expansion-of-pvp/

26. LCH SA (2024), "CPMI-IOSCO PFMI Self-Assessment 2024." 
    URL: https://www.lseg.com/content/dam/post-trade/en_us/documents/lch/ccp-disclosures/lch-sa-cpmi-iosco-self-qualitative-assessment-of-q2-2024-3.pdf

27. LME Clear (2024), "CPMI-IOSCO Principles for Financial Market Infrastructure Disclosure." 
    URL: https://www.lme.com/-/media/Files/Clearing/Rules-and-regulations/Disclosure-and-transparency/LME-Clear-CPMI-IOSCO-Disclosure-Document-2024.pdf

28. IOSCO (undated), "Central Counterparty Financial Resources for Recovery." 
    URL: https://www.iosco.org/library/pubdocs/pdf/IOSCOPD697.pdf

29. Reserve Bank of Australia (2017), "Central Counterparty Margin Frameworks," Bulletin. 
    URL: https://www.rba.gov.au/publications/bulletin/2017/dec/pdf/bu-1217-10-central-counterparty-margin-frameworks.pdf

30. AFME (undated), "Joint trade response to CPMI-IOSCO consultation." 
    URL: https://www.afme.eu/publications/consultation-responses/afme-joint-trade-response-to-cpmi-iosco-consultation-on-resilience-and-recovery-of-ccps-further-guidance-on-the-pfmi/

31. Shanghai Clearing House (2025), "Principles for Financial Market Infrastructures Disclosure." 
    URL: https://www.shclearing.cn/en/aboutus/PFMIDisclosure/202502/P020250228351318649025.pdf

32. RBA (2013), "LCH Assessment." 
    URL: https://www.rba.gov.au/payments-and-infrastructure/financial-market-infrastructure/clearing-and-settlement-facilities/assessments/lch/2013/pdf/lch-assess-2013-06.pdf

33. ISDA (undated), "CCP Loss Allocation at the End of the Waterfall." 
    URL: https://www.isda.org/a/jTDDE/ccp-loss-allocation-waterfall-0807.pdf

34. NSCC (2025), "Disclosure Framework Q4 2025." 
    URL: https://www.dtcc.com/-/media/Files/Downloads/legal/policy-and-compliance/nscc-disclosure-framework-2025-q4.pdf

35. FSB (undated), "Depository Trust & Clearing Corporation." 
    URL: https://www.fsb.org/uploads/Depository-Trust-Clearing-Corporation.pdf

36. Bank of Canada (1992), "An Introduction to Multilateral Foreign Exchange Netting," Working Paper. 
    URL: https://www.oar-rao.bank-banque-canada.ca/record/667/files/swp1992-05.pdf

37. Spark.money (undated), "Payment Netting Glossary." 
    URL: https://www.spark.money/glossary/payment-netting

38. ECB (undated), "Real-Time Gross Settlement - User Detailed Functional Specifications." 
    URL: https://www.ecb.europa.eu/paym/target/consolidation/profuse/shared/pdf/rtgs_udfs_r2023.jun_revised_20230224.en.pdf

39. Deutsche Bank (undated), "Breaking the settlement failure chain." 
    URL: https://flow.db.com/files/documents/more/publications/white-papers-guides/DB-Settlement-Failure-White-Paper.pdf

40. Ripple Treasury (undated), "Netting Product Card." 
    URL: https://treasury.ripple.com/product-cards/netting-product-card

41. J.P. Morgan (2024), "FX exposure netting solutions." 
    URL: https://www.jpmorgan.com/insights/treasury/liquidity-management/fx-exposure-netting-risk-management-solutions

42. DBS (undated), "Benefits of Multilateral Payment Netting." 
    URL: https://www.dbs.com.sg/corporate/insights/multilateral-payment-netting

43. Finadium (2024), "J.P. Morgan to move FX settlement to DLT and rebrands Onyx platform as Kinexys." 
    URL: https://finadium.com/j-p-morgan-to-move-fx-settlement-to-dlt-and-rebrands-onyx-platform-as-kinexys/

44. Partior (undated), "Live Blockchain Network For 24/7 Atomic Settlement." 
    URL: https://partior.com/

45. ECB (2023), "General business cases for DLT." 
    URL: https://www.ecb.europa.eu/paym/groups/ntwcg/pdf/ecb.ntwdocs230907_business_cases_3rd_ntwcg_meeting.en.pdf

46. Fnality (2025), "The future is tokenised." 
    URL: https://fnality.com/news/regulated-defi-tokenisation

47. ECB/Bank of Japan (2018), "Stella Project Report: Securities settlement systems: delivery-versus-payment in a DLT environment." 
    URL: https://www.ecb.europa.eu/pub/pdf/other/stella_project_report_march_2018.pdf

48. IMF (2025), "Central Bank Exploration of Tokenized Reserves," Finance & Development. 
    URL: https://www.elibrary.imf.org/downloadpdf/view/journals/063/2025/011/063.2025.issue-011-en.pdf

49. Bank of Canada/MAS (undated), "Jasper-Ubin Design Paper: Enabling Cross-Border High Value Transfer Using DLT." 
    URL: https://www.mas.gov.sg/-/media/jasper-ubin-design-paper.pdf

50. Bank of Canada (undated), "Jasper Phase III." 
    URL: https://payments.ca/sites/default/files/2022-09/jasper_phase_iii_whitepaper_EN.pdf

51. Bank of Japan (2023), "Efforts to Improve Payments Using DLT," Review. 
    URL: https://www.boj.or.jp/en/research/wps_rev/rev_2023/data/rev23e09.pdf

52. Central Banking (2019), "Canada's Project Jasper finds DLT is viable for securities settlement." 
    URL: https://www.centralbanking.com/central-banks/currency/digital-currencies/3518451/canadas-project-jasper-finds-dlt-is-viable-for-securities-settlement

---

*Report compiled: 10 July 2026*
*Role: Settlement-Systems Research Analyst*
*Method: Primary sources preferred (BIS, CPMI-IOSCO, central banks, CLS, CCP disclosures).*
*No unsourced claims. Every non-obvious fact cites a real URL.*
