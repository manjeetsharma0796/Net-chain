# NetChain Contract Guide (for frontend/backend developers)

This is the reference for calling any NetChain contract directly over the **JSON
Ledger API v2**. There is no SDK: every call in this repo is a plain HTTPS
request built by `lib/ledger-server.ts` and reached from the frontend through
`app/api/ledger/[op]`. If you have never seen this repo, this file plus
`daml/README.md`'s frozen model table is enough to call any of the 5 templates.

The model itself (`Account`, `Obligation`, `TreasuryPolicy`, `NetPosition`,
`NettingCycle`) is defined in `daml/daml/NetChain.daml`. The full API walkthrough,
including every gotcha referenced below, lives in
[`CANTON_E2E_GUIDE.md`](./CANTON_E2E_GUIDE.md).

## 1. Connecting

**Auth.** The ledger uses an M2M `client_credentials` OAuth token. You exchange
`CLIENT_ID` / `CLIENT_SECRET` (from your untracked `.env`, see `.env.example`)
at `TOKEN_ENDPOINT` for a bearer token, then send `Authorization: Bearer $TOKEN`
on every call. `lib/ledger-server.ts` does this once, caches the token for 7h,
and the secret never leaves the server (route handlers under `app/api/ledger/*`
are the only thing that ever calls the ledger; the browser never sees
`CLIENT_SECRET`).

**Base URL.** `BASE` from `.env` (`https://ledger-api.validator.devnet.sandbox.fivenorth.io`
on the current devnet). All paths below are relative to `$BASE`.

**Two `templateId` forms (E2E guide G1).** This is the single most common
mistake, so it's worth restating up front:

- **Commands** (`CreateCommand`, `ExerciseCommand`) use the deployed **package id**:
  `"$NETCHAIN_PKG_ID:NetChain:<Template>"`
- **Filters** (ACS queries, updates/events) use the **package name**, prefixed with `#`:
  `"#netchain:NetChain:<Template>"`

In code this is `tid()` vs `fid()` in `lib/ledger-server.ts`:

```ts
const tid = (t: string) => `${PKG}:NetChain:${t}`;   // command form (G1)
const fid = (t: string) => `#netchain:NetChain:${t}`; // filter form (G1)
```

`$NETCHAIN_PKG_ID` below is a placeholder for the deployed package id (see
`daml/README.md`; do not paste any secret into requests).

**Decimals and Ints are JSON strings (G2).** Every `Decimal` field (`balance`,
`amount`, `maxSettlementPerCycle`, `net`) must be sent as a quoted string, e.g.
`"amount": "100000.0"`, never a bare number. `lib/ledger-server.ts` does this
with `.toFixed(1)` on every numeric field before it goes on the wire.

**`actAs` must cover every signatory (G5/G6).** Whichever party is written into
a template's signatory field(s) in your `createArguments`, or whichever party is
the choice's `controller`, must be in the `actAs` array of the submit call.
NetChain uses a single shared M2M token: `actAs` just needs to name the right
party string for each call (see the per-template tables below), there is no
separate login per party.

## 2. The frozen model

Reproduced from `daml/README.md` (source of truth, do not re-derive it):

| Template | Fields | Signatory | Observer | Choices |
|----------|--------|-----------|----------|---------|
| `Account` | operator, owner, balance | operator | owner | -- |
| `Obligation` | operator, obligor, obligee, amount, reference, dueDate, settled | obligor | obligee, operator | -- |
| `TreasuryPolicy` | operator, party, maxSettlementPerCycle | party | operator | `CheckSettlement(amount)` |
| `NetPosition` | operator, party, cycleId, net | operator | party | -- |
| `NettingCycle` | operator, participants, obligationCids, settled | operator | participants | `ComputeNetPositions(cycleId) -> [NetPosition]`, `Settle(cycleId, netPositionCids, accountCids, policyCids)` |

Settlement model: the `operator` is the netting bank. It holds every `Account`
and is the controller of `Settle`, so there is no propose/accept dance and no
allocation contracts, one `actAs` per call is always enough.

## 3. Submit envelope

Every write goes through the same envelope (`submit()` in `lib/ledger-server.ts`):

```json
{
  "actAs": ["<PARTY>"],
  "readAs": [],
  "userId": "6",
  "commandId": "nc-<unique>",
  "deduplicationPeriod": { "Empty": {} },
  "commands": [ { "CreateCommand": { ... } } ]
}
```

POST this to `/v2/commands/submit-and-wait`. Remember (G3): it returns only
`{"updateId": "...", "completionOffset": "..."}`, never the new contract id. To
get a contract id back, either query the ACS afterward (what this app does) or
call `/v2/commands/submit-and-wait-for-transaction` instead, which returns the
created events.

Every read goes through `/v2/state/active-contracts` with a `TemplateFilter`
scoped to one party (see per-template examples). Fetch the current offset
first from `/v2/state/ledger-end` and pass it as `activeAtOffset`.

## 4. Account

Fields: `operator`, `owner`, `balance : Decimal`. Signatory `operator`,
observer `owner`, so each owner's ACS query only ever returns its own account.
No choices.

In this app, `Account` contracts are seeded by `daml/deploy.sh`, not created
through `app/api/ledger`. Only `Settle` (below) ever archives/recreates them.
You will still query them, actAs the operator (or the owner, for their own
account) and use the filter form of the templateId:

```bash
OFFSET=$(curl -s "$BASE/v2/state/ledger-end" -H "Authorization: Bearer $TOKEN" | python3 -c 'import sys,json;print(json.load(sys.stdin)["offset"])')

curl -s -X POST "$BASE/v2/state/active-contracts" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{
  "filter": { "filtersByParty": { "'"$OPERATOR"'": { "cumulative": [
    { "identifierFilter": { "TemplateFilter": { "value": {
      "templateId": "#netchain:NetChain:Account", "includeCreatedEventBlob": false
    } } } }
  ] } } },
  "verbose": true,
  "activeAtOffset": '"$OFFSET"'
}'
```

actAs for a create (if you ever need one): `operator` (it is the sole
signatory).

## 5. Obligation

Fields: `operator`, `obligor`, `obligee`, `amount : Decimal`, `reference`,
`dueDate`, `settled : Bool`. Signatory `obligor`, observers `obligee` and
`operator`. No third party (a counterparty of the counterparty) can see it,
this is the on-ledger privacy property the model is built around.

**Create** (`createObligation` in `lib/ledger-server.ts`, actAs the `obligor`
because it is the signatory):

```bash
curl -s -X POST "$BASE/v2/commands/submit-and-wait" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{
  "actAs": ["'"$COMPANY_A"'"], "readAs": [], "userId": "6",
  "commandId": "nc-obl-1", "deduplicationPeriod": { "Empty": {} },
  "commands": [{ "CreateCommand": {
    "templateId": "$NETCHAIN_PKG_ID:NetChain:Obligation",
    "createArguments": {
      "operator": "'"$OPERATOR"'",
      "obligor": "'"$COMPANY_A"'",
      "obligee": "'"$COMPANY_B"'",
      "amount": "100000.0",
      "reference": "INV-1042",
      "dueDate": "2026-08-01",
      "settled": false
    }
  } }]
}'
```

**Query (ACS)**, actAs/filter party = whichever party is reading (an obligor or
obligee only ever sees its own obligations, per the observer list above):

```bash
curl -s -X POST "$BASE/v2/state/active-contracts" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{
  "filter": { "filtersByParty": { "'"$COMPANY_A"'": { "cumulative": [
    { "identifierFilter": { "TemplateFilter": { "value": {
      "templateId": "#netchain:NetChain:Obligation", "includeCreatedEventBlob": false
    } } } }
  ] } } },
  "verbose": true,
  "activeAtOffset": '"$OFFSET"'
}'
```

A single contract lookup (`getContract` in `lib/ledger-server.ts`) is just this
same ACS query filtered client-side by `contractId`: there is no
`GET /v2/contracts/{id}` in this app, because a per-party ACS miss is itself the
real privacy signal (a party that isn't a stakeholder simply never sees the
row, so a 404 from `app/api/ledger/contract` means "not visible to you", not
necessarily "does not exist").

## 6. TreasuryPolicy

Fields: `operator`, `party`, `maxSettlementPerCycle : Decimal`. Signatory
`party` (each company owns its own cap), observer `operator`. One
nonconsuming choice: `CheckSettlement(amount)`, controller `operator`, the
non-bypassable gate: an over-cap `amount` fails inside the ledger with an
assertion, not in the UI.

**Exercise `CheckSettlement`** (`checkPolicy` in `lib/ledger-server.ts`, actAs
`operator` because it is the controller; the policy contract id itself is
found first via an ACS query as the operator, since operator is an observer):

```bash
curl -s -X POST "$BASE/v2/commands/submit-and-wait" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{
  "actAs": ["'"$OPERATOR"'"], "readAs": [], "userId": "6",
  "commandId": "nc-check-1", "deduplicationPeriod": { "Empty": {} },
  "commands": [{ "ExerciseCommand": {
    "templateId": "$NETCHAIN_PKG_ID:NetChain:TreasuryPolicy",
    "contractId": "<POLICY_CID>",
    "choice": "CheckSettlement",
    "choiceArgument": { "amount": "250000.0" }
  } }]
}'
```

A breach comes back as an ordinary ledger error (`{"code":..., "cause":...}`,
G8), not a 200 with an error field, catch it as a rejection rather than
parsing the response body for a verdict.

## 7. NetPosition

Fields: `operator`, `party`, `cycleId`, `net : Decimal`. Signatory `operator`,
observer `party`, so party A can never read party B's net figure off the
ledger. No choices: instances are only ever produced by
`NettingCycle.ComputeNetPositions` (see below), never created directly.

**Query**, actAs/filter party = the party reading its own net position (or
`operator`, who can see all of them since it is the signatory):

```bash
curl -s -X POST "$BASE/v2/state/active-contracts" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{
  "filter": { "filtersByParty": { "'"$COMPANY_A"'": { "cumulative": [
    { "identifierFilter": { "TemplateFilter": { "value": {
      "templateId": "#netchain:NetChain:NetPosition", "includeCreatedEventBlob": false
    } } } }
  ] } } },
  "verbose": true,
  "activeAtOffset": '"$OFFSET"'
}'
```

`getNetPosition` in `lib/ledger-server.ts` takes the last matching row for the
party, since a consuming `Settle` never touches `NetPosition` itself but a new
cycle can add more of them over time.

## 8. NettingCycle

Fields: `operator`, `participants : [Party]`, `obligationCids : [ContractId
Obligation]`, `settled : Bool`. Signatory `operator`, observer `participants`.
Two choices, both controller `operator`:

- `ComputeNetPositions(cycleId) -> [ContractId NetPosition]`: nonconsuming,
  reads every obligation in `obligationCids` and emits one `NetPosition` per
  participant (`receivable - payable`).
- `Settle(cycleId, netPositionCids, accountCids, policyCids) -> ContractId
  NettingCycle`: consuming. Asserts every net is within that party's
  `TreasuryPolicy` cap, then archives and recreates every `Account` with its
  balance moved by that party's net, all in one commit. If any assertion
  fails, the whole transaction rolls back and nothing moves (atomic DvP);
  there is no partial settlement.

**Create a cycle** (actAs `operator`, the signatory):

```bash
curl -s -X POST "$BASE/v2/commands/submit-and-wait" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{
  "actAs": ["'"$OPERATOR"'"], "readAs": [], "userId": "6",
  "commandId": "nc-cycle-1", "deduplicationPeriod": { "Empty": {} },
  "commands": [{ "CreateCommand": {
    "templateId": "$NETCHAIN_PKG_ID:NetChain:NettingCycle",
    "createArguments": {
      "operator": "'"$OPERATOR"'",
      "participants": ["'"$COMPANY_A"'", "'"$COMPANY_B"'", "'"$COMPANY_C"'"],
      "obligationCids": ["<OBLIGATION_CID_1>", "<OBLIGATION_CID_2>"],
      "settled": false
    }
  } }]
}'
```

Since `submit-and-wait` does not return the new contract id (G3), find the
cycle's contract id afterward by querying the ACS as `operator` for
`NettingCycle` and taking the still-`settled: false` row, exactly what
`latestUnsettled()` in `lib/ledger-server.ts` does.

**Exercise `ComputeNetPositions`** (actAs `operator`):

```bash
curl -s -X POST "$BASE/v2/commands/submit-and-wait" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{
  "actAs": ["'"$OPERATOR"'"], "readAs": [], "userId": "6",
  "commandId": "nc-cnp-1", "deduplicationPeriod": { "Empty": {} },
  "commands": [{ "ExerciseCommand": {
    "templateId": "$NETCHAIN_PKG_ID:NetChain:NettingCycle",
    "contractId": "<CYCLE_CID>",
    "choice": "ComputeNetPositions",
    "choiceArgument": { "cycleId": "cyc-2026-07-10" }
  } }]
}'
```

Then query the ACS as `operator` for `NetPosition`, `Account`, and
`TreasuryPolicy` to collect the contract ids `Settle` needs.

**Exercise `Settle`** (actAs `operator`, this is a consuming choice, so it
archives the `NettingCycle` and every settled `Account`, and creates
successors with new contract ids, G4):

```bash
curl -s -X POST "$BASE/v2/commands/submit-and-wait" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{
  "actAs": ["'"$OPERATOR"'"], "readAs": [], "userId": "6",
  "commandId": "nc-settle-1", "deduplicationPeriod": { "Empty": {} },
  "commands": [{ "ExerciseCommand": {
    "templateId": "$NETCHAIN_PKG_ID:NetChain:NettingCycle",
    "contractId": "<CYCLE_CID>",
    "choice": "Settle",
    "choiceArgument": {
      "cycleId": "cyc-2026-07-10",
      "netPositionCids": ["<NP_CID_1>", "<NP_CID_2>", "<NP_CID_3>"],
      "accountCids": ["<ACC_CID_1>", "<ACC_CID_2>", "<ACC_CID_3>"],
      "policyCids": ["<POL_CID_1>", "<POL_CID_2>", "<POL_CID_3>"]
    }
  } }]
}'
```

`lib/ledger-server.ts`'s `runAndSettle()` runs all four steps above (create
cycle, `ComputeNetPositions`, gather contract ids, `Settle`) as one
server-side sequence and returns the real `updateId` from `Settle` plus the
resulting net positions; that is what `POST /api/ledger/settle` calls.

## 9. From the frontend

The browser never talks to the ledger or holds the M2M secret. The call chain
is:

```
component  ->  lib/ledger.ts  ->  fetch("/api/ledger/<op>")  ->  app/api/ledger/[op]/route.ts  ->  lib/ledger-server.ts  ->  ledger HTTPS
```

- `lib/ledger.ts` mirrors the mock API in `lib/api.ts` function-for-function
  (`getObligationsFor`, `queryContract`, `getNetPositionFor`, `checkPolicy`,
  `createObligationLive`, `settleLive`), so a page switches from mock to live
  data by changing only its import, no call-site changes.
- The `NEXT_PUBLIC_LEDGER_LIVE` env flag gates everything: `LIVE =
  process.env.NEXT_PUBLIC_LEDGER_LIVE === "1"`. When it is off, `lib/ledger.ts`
  calls straight into `lib/api.ts`'s mock demo data.
- When it is on, `lib/ledger.ts` fetches `/api/ledger/<op>`. The route handler
  calls `isLive()` in `lib/ledger-server.ts` (true only when `BASE`,
  `NETCHAIN_PKG_ID`, `CLIENT_SECRET`, and all four party env vars are set) and
  returns HTTP 503 if not configured.
- `lib/ledger.ts` treats a 503, a network error, or any non-OK response (other
  than a real 404 from `queryContract`) as "fall back to the mock", so the
  demo degrades gracefully rather than hard-breaking. A 404 from
  `queryContract` is the one case that is not swallowed: it surfaces as a
  genuine `PrivacyError`, because it means the ledger itself would not confirm
  the contract to that party.

## 10. Common errors

Drawn from the gotchas in `CANTON_E2E_GUIDE.md`:

- **Wrong templateId form (G1).** `LEDGER_API_INTERNAL_ERROR` or `INVALID_FIELD
  ... expected a package name`. Commands use `$NETCHAIN_PKG_ID:NetChain:<T>`,
  filters use `#netchain:NetChain:<T>`. Mixing them up is the single most
  common mistake.
- **Number instead of string (G2).** `"amount": 100000.0` fails with
  `LEDGER_API_INTERNAL_ERROR: Expected ujson.Str`. Every `Decimal` and `Int`
  field must be a quoted string.
- **Expecting a contract id from `submit-and-wait` (G3).** It only returns
  `{"updateId", "completionOffset"}`. Query the ACS afterward, or call
  `submit-and-wait-for-transaction` if you need the id in the same round trip.
- **Looking for an archived contract in the ACS (G4).** `active-contracts`
  only returns currently-active contracts. A consuming choice (like `Settle`)
  archives the old contract and creates a successor with a new contract id;
  the old id is gone from the ACS even though the underlying account still
  "exists" in spirit.
- **Missing signatory in `actAs` (G5/G6).** `DAML_AUTHORIZATION_ERROR: requires
  authorizers <party>, but only <other> were given`. Whichever party appears
  as a signatory in your `createArguments`, or is the choice's controller,
  must be in `actAs`. (User also needs `CanActAs` for that party, granted via
  `POST /v2/users/{id}/rights`, separately from the template-level check.)
- **Treating a ledger error as success (G8).** Errors come back as
  `{"code":..., "cause":...}` with a 4xx/5xx HTTP status, not a 200 with a
  status field. `lib/ledger-server.ts`'s `post()` checks for `"code"` and
  `"cause"` in the parsed body before treating a response as success, do the
  same in any code you add.
- **A `TreasuryPolicy` breach looks like a normal request failure.**
  `CheckSettlement` and `Settle` reject by throwing/erroring rather than
  returning an "ok: false" payload; check for the ledger error, not a boolean
  field, unless you are calling through `checkPolicy()` in
  `lib/ledger-server.ts`, which already normalizes this into `{ ok, ruleFired
  }`.
