# NetChain Architecture

NetChain is a privacy-preserving multilateral netting and atomic settlement demo running on a Canton (5N) Devnet validator, fronted by a Next.js 14 app. A single operator party (the netting bank) holds every `Account` and runs each netting cycle; the three counterparties (`company-a/b/c`) never see each other's obligations or net positions on the ledger, only their own. The frontend talks to the ledger through one thin client shim, a server-only route layer, and a JSON Ledger API v2 client that holds the M2M credentials; every call degrades to a local mock when the ledger isn't configured or a request fails, except for a genuine per-party projection miss, which surfaces as a real privacy error instead of being swallowed.

## 1. Request flow: browser to validator and back

```mermaid
flowchart TD
    U["Party switcher (TopBar)\nsets currentPartyId in lib/store.ts"] --> P["App page\n(privacy-check / cycle / settlement / policy / obligations)"]
    P --> L["lib/ledger.ts\nclient shim, mirrors lib/api.ts signatures"]

    L --> FLAG{"NEXT_PUBLIC_LEDGER_LIVE === '1'?"}
    FLAG -- "no" --> MOCK["lib/api.ts\nin-memory mock ledger"]
    FLAG -- "yes" --> FETCH["fetch('/api/ledger/&lt;op&gt;')"]

    FETCH --> ROUTE["app/api/ledger/[op]/route.ts\nGET: obligations, net-position, contract\nPOST: obligation, policy-check, settle"]
    ROUTE --> GUARD{"isLive()?\n(lib/ledger-server.ts)"}
    GUARD -- "no, 503" --> MOCK
    GUARD -- "yes" --> SRV["lib/ledger-server.ts\nserver-only: CLIENT_SECRET, cached ~8h OAuth token"]

    SRV --> TOKEN["POST TOKEN_ENDPOINT\nclient_credentials grant"]
    SRV --> API["JSON Ledger API v2\nPOST /v2/commands/submit-and-wait\nPOST /v2/state/active-contracts\nGET /v2/state/ledger-end"]
    API --> VAL["5N Devnet validator"]

    VAL --> API
    API --> SRV
    SRV -- "network error / thrown LedgerError" --> ROUTE
    ROUTE -- "502, or 503 from guard" --> L
    L -- "non-2xx / network error" --> MOCK

    ROUTE -- "GET contract, real 404\nCONTRACT_NOT_FOUND" --> L
    L -- "queryContract():\nstatus === 404 -> throw PrivacyError" --> PRIV["PrivacyError surfaced to UI\n(privacy-check page)\nnot swallowed into the mock"]

    MOCK --> P
    PRIV --> P
```

Key code references:
- `lib/ledger.ts`: `getObligationsFor`, `queryContract`, `getNetPositionFor`, `checkPolicy`, `createObligationLive`, `settleLive`. Only `queryContract` treats HTTP 404 as a real `PrivacyError`; every other failure (non-OK response, thrown exception) falls through to the corresponding function in `lib/api.ts`.
- `app/api/ledger/[op]/route.ts`: `guard()` returns 503 when `isLive()` is false, which is exactly the signal `lib/ledger.ts` treats as "fall back to mock." `fail()` maps any thrown error to 502.
- `lib/ledger-server.ts`: `isLive()` requires `BASE`, `PKG`, `CLIENT_SECRET`, and all four `NETCHAIN_*` party ids to be set. `token()` caches the OAuth token for 7h (tokens live ~8h). `post()` treats a JSON body with both `code` and `cause` as an error per the JSON Ledger API's error shape.

## 2. Netting cycle sequence: obligations to settlement

```mermaid
sequenceDiagram
    participant UI as App page (cycle / settlement)
    participant Route as route.ts (/api/ledger/*)
    participant Srv as lib/ledger-server.ts
    participant Ledger as JSON Ledger API v2
    participant Validator as 5N Devnet validator

    Note over UI,Validator: Step 1 - Obligations (one per obligor, actAs obligor)
    UI->>Route: POST /api/ledger/obligation {obligor, obligee, amount, reference, dueDate}
    Route->>Srv: createObligation(input)
    Srv->>Ledger: POST /v2/commands/submit-and-wait\nCreateCommand Obligation, actAs=[obligor]
    Ledger->>Validator: commit
    Validator-->>Ledger: updateId
    Ledger-->>Srv: updateId
    Srv-->>Route: {updateId}
    Route-->>UI: {updateId}

    Note over UI,Validator: Step 2 - Run cycle (actAs operator, runAndSettle())
    UI->>Route: POST /api/ledger/settle
    Route->>Srv: runAndSettle()
    Srv->>Ledger: POST /v2/state/active-contracts (Obligation, filter settled=false)
    Ledger-->>Srv: open obligation contract ids
    Srv->>Ledger: POST /v2/commands/submit-and-wait\nCreateCommand NettingCycle {operator, participants, obligationCids}
    Ledger->>Validator: commit
    Validator-->>Ledger: ok
    Srv->>Ledger: POST /v2/state/active-contracts (NettingCycle) -> latest unsettled cycleCid

    Note over Srv,Validator: ComputeNetPositions - per-party net = receivable - payable
    Srv->>Ledger: POST /v2/commands/submit-and-wait\nExerciseCommand NettingCycle.ComputeNetPositions {cycleId}
    Ledger->>Validator: fetch obligations, create one NetPosition per participant
    Validator-->>Ledger: ok
    Srv->>Ledger: POST /v2/state/active-contracts (NetPosition, Account, TreasuryPolicy)
    Ledger-->>Srv: netPositionCids, accountCids, policyCids

    Note over Srv,Validator: Settle - atomic, policy-gated, all-or-nothing
    Srv->>Ledger: POST /v2/commands/submit-and-wait\nExerciseCommand NettingCycle.Settle\n{cycleId, netPositionCids, accountCids, policyCids}
    Ledger->>Validator: for each NetPosition, assert abs(net) <= matching TreasuryPolicy.maxSettlementPerCycle
    alt any assertion fails
        Validator-->>Ledger: COMMAND_FAILED, whole commit rolled back
        Ledger-->>Srv: throw LedgerError (surfaced as 502)
    else all within cap
        Validator->>Validator: archive each Account, recreate with balance + net (all in one transaction)
        Validator-->>Ledger: updateId, NettingCycle{settled=true}
        Ledger-->>Srv: updateId
    end
    Srv-->>Route: {updateId, netPositions}
    Route-->>UI: {updateId, netPositions}

    Note over UI,Validator: Step 3 - read back, scoped per party
    UI->>Route: GET /api/ledger/net-position?party=company-a
    Route->>Srv: getNetPosition("company-a")
    Srv->>Ledger: POST /v2/state/active-contracts (NetPosition, filter party=company-a)
    Ledger-->>Srv: only company-a's NetPosition row
    Srv-->>Route: NetPosition | null
    Route-->>UI: NetPosition | null
```

This mirrors `runAndSettle()` in `lib/ledger-server.ts`: create obligations, create a `NettingCycle`, exercise `ComputeNetPositions`, then exercise `Settle` with the fetched `netPositionCids` / `accountCids` / `policyCids`. The `Settle` choice in `daml/daml/NetChain.daml` asserts every party's `abs(net)` is within its `TreasuryPolicy.maxSettlementPerCycle` before archiving and recreating any `Account`; a failed assertion rolls back the entire transaction, so no balance ever moves partially. On the live 5N Devnet run this produced settled balances A=115k, B=130k, C=55k, with nets +15k/+30k/-45k summing to zero.

## 3. UI action to endpoint to template to actAs

| UI action | Page | `lib/ledger.ts` call | Route (`app/api/ledger/[op]`) | `lib/ledger-server.ts` fn | Daml template / choice | `actAs` |
|---|---|---|---|---|---|---|
| Load "your projection" | `app/app/privacy-check/page.tsx` | `getObligationsFor` | `GET /api/ledger/obligations?party=` | `listObligations` | `Obligation` (ACS query) | current party |
| Query a foreign contract | `app/app/privacy-check/page.tsx` | `queryContract` | `GET /api/ledger/contract?party=&contractId=` | `getContract` | `Obligation` (ACS query, filtered) | current party (404 = `PrivacyError`) |
| View your net position | `app/app/cycle/page.tsx` (party view) | `getNetPositionFor` | `GET /api/ledger/net-position?party=` | `getNetPosition` | `NetPosition` (ACS query) | current party |
| Create an obligation (agent or manual) | `app/app/obligations/page.tsx` | `createObligationLive` | `POST /api/ledger/obligation` | `createObligation` | `Obligation` (create) | obligor |
| Agent over-threshold attempt | `app/app/policy/page.tsx` | `checkPolicy` | `POST /api/ledger/policy-check` | `checkPolicy` | `TreasuryPolicy.CheckSettlement` (exercise) | operator |
| Run netting cycle + settle | `app/app/cycle/page.tsx`, `app/app/settlement/page.tsx` | `settleLive` | `POST /api/ledger/settle` | `runAndSettle` | `NettingCycle` create, `ComputeNetPositions`, `Settle` | operator |

Note: the netting cycle's client-visible math (`computeNetPositions`, `buildSettlementLegs` on `app/app/cycle/page.tsx`) runs against the local mock state for the animated demo UI; `settleLive()` separately runs the real `Settle` on-ledger and the resulting `updateId` (or a mock tx hash, `newTxHash`, when not live) is what the settlement page displays as the transaction hash.
