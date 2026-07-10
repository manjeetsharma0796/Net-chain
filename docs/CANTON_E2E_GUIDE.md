# Canton Devnet, End-to-End Agent Guide

> ⚠️ **Secret redacted for the public repo.** The M2M `CLIENT_SECRET` is NOT in this
> file. Put it in an untracked `.env` (see `.env.example`) and `source` it. All other
> values here are devnet-only public identifiers, safe to share.

Everything needed to build, upload, and interact with Daml contracts on the
Five North (fivenorth) devnet validator via the **JSON Ledger API v2**.
Written from a full working session, every command here was run and verified.

> Read the **Gotchas** section first, it's where the time gets lost.

---

## 0. Quick start (copy-paste)

```bash
export BASE="https://ledger-api.validator.devnet.sandbox.fivenorth.io"
# CLIENT_SECRET comes from your untracked .env (see .env.example), NEVER commit it.
export CLIENT_SECRET="${CLIENT_SECRET:?set CLIENT_SECRET in your .env}"

# 1. token (expires every 8h)
export TOKEN=$(curl -sS -X POST 'https://auth.sandbox.fivenorth.io/application/o/token/' \
  -d grant_type=client_credentials -d client_id=validator-devnet-m2m \
  -d client_secret="$CLIENT_SECRET" -d audience=validator-devnet-m2m -d scope=daml_ledger_api \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')

# 2. sanity check
curl -sS "$BASE/v2/state/ledger-end" -H "Authorization: Bearer $TOKEN"   # -> {"offset":N}
```

This repo already has working scripts: `lib.sh` (bootstrap), `addparty.sh`,
`shared.sh`, `counter/counter.sh`, and a central `.env`. Reuse them.

---

## 1. Environment / credentials (the whole set)

| Name | Value |
|---|---|
| REST base | `https://ledger-api.validator.devnet.sandbox.fivenorth.io` |
| WebSocket base | `wss://ledger-api.validator.devnet.sandbox.fivenorth.io` |
| Token endpoint | `https://auth.sandbox.fivenorth.io/application/o/token/` |
| Client ID | `validator-devnet-m2m` |
| Client Secret | `*redacted, see `.env.example` / 5N access doc*` |
| Grant type | `client_credentials` |
| Audience | `validator-devnet-m2m` |
| Scope | `daml_ledger_api` |
| **User ID** | `6` (the token's `sub` claim) |
| **Primary party** | `5nsandbox-devnet-2::1220a14ca128063b8dc9d1ebb0bd22633be9f2168500f4dbc1ecaeb1855b14e5acf8` |
| **Participant fingerprint** | `1220a14ca128063b8dc9d1ebb0bd22633be9f2168500f4dbc1ecaeb1855b14e5acf8` |
| **Synchronizer (domain)** | `global-domain::1220be58c29e65de40bf273be1dc2b266d43a9a002ea5b18955aeef7aac881bb471a` |
| Daml SDK | `3.5.2` (LF 2.3 / PV35), NetChain's pinned toolchain; the `3.4.11` values elsewhere in this guide are from the earlier counter-app session |

Notes:
- This is a **shared M2M credential** = one user (`6`) = one primary party.
  Everyone using it authenticates as user 6.
- **No faucet / no gas needed.** Traffic is sponsored on devnet; all
  create/exercise/upload calls are free.
- Get `USER_ID` from the JWT `sub`; get the primary party from
  `GET /v2/users/{USER_ID}` -> `.user.primaryParty`.

---

## 2. GOTCHAS (the unique, non-obvious learnings) ⚠️

These are the things that cost real time. Internalize them.

### G1. Package-ID form vs `#package-name` form, different per call type
- **Commands** (`CreateCommand`, `ExerciseCommand`) use the **package-ID**:
  `templateId = "<pkgId>:Module:Template"`
- **Filters** (ACS, updates) use the **`#package-name`**:
  `templateId = "#<pkgName>:Module:Template"`
- Using the wrong one gives:
  `INVALID_FIELD ... expected a package name` (in a filter), or the reverse.
- Example: command `b5a9...:Counter:Counter`; filter `#counter:Counter:Counter`.

### G2. `Int` and `Decimal` must be JSON **strings**
- `"count":"0"` ✅ , `"count":0` ❌ -> `LEDGER_API_INTERNAL_ERROR: Expected ujson.Str`
- `Decimal` likewise: `"amount":"999.99"`.

### G3. `submit-and-wait` does NOT return the contractId
- It returns only `{"updateId","completionOffset"}`.
- To get the new contractId either:
  - use `POST /v2/commands/submit-and-wait-for-transaction` (returns events), or
  - query the ACS afterward.

### G4. ACS is "active only"; archived contracts live in the history
- `POST /v2/state/active-contracts` = currently-active contracts only.
- A **consuming choice archives the old contract and creates a new one with a
  new contractId**, the count/state "changes" by producing a successor.
- Read archived state via `POST /v2/events/events-by-contract-id`
  (returns both `created` (full payload) and `archived` events) or via
  `POST /v2/updates/flats`. Readable until the participant **prunes**.

### G5. `actAs` must include every signatory named in the payload
- `Counter` has `signatory owner`. If you `actAs:[Dave]` but set
  `owner:<primary>`, you get:
  `DAML_AUTHORIZATION_ERROR: requires authorizers <primary>, but only Dave were given`.
- Rule: whoever you write into a **signatory** field must be in `actAs`.

### G6. Two authorization layers, both required to act as a party
1. **User right:** user must have `CanActAs <party>` (grant via
   `POST /v2/users/{id}/rights`).
2. **Template auth:** the party must be a required authorizer (signatory) -
   or the choice's controller, for that specific action.

### G7. Party allocation works with this token
- `POST /v2/parties {"partyIdHint":"Bob"}` returns
  `Bob::<participant-fingerprint>`. The `::1220a14c…` suffix is appended by the
  node; you don't choose it. Every local party shares that fingerprint.

### G8. Response shapes for parsing
- ACS entry: `d["contractEntry"]["JsActiveContract"]["createdEvent"]`
  with `.contractId`, `.templateId`, `.createArgument`.
- Updates: `u["update"]["Transaction"]["value"]["events"][*]` where each event
  is `{"CreatedEvent":{...}}` or `{"ArchivedEvent":{...}}`.
- Errors come back as `{"code":..., "cause":...}` with HTTP 4xx/5xx, check for
  `.code` before assuming success (a naive `len(json)` will count an error
  object as "1 result").

### G9. The block explorer (Lighthouse) will NOT show your payload
- `lighthouse.devnet.cantonloop.com` shows app txs as `Private Tx` (no
  contract id / args), plus Canton Coin activity and party topology.
- It also lags (~a day). Your data is only fully visible via the Ledger API.

---

## 3. Build a DAR

`daml.yaml`:
```yaml
sdk-version: 3.4.11
name: mypkg
source: daml
version: 1.0.0
dependencies:
  - daml-prim
  - daml-stdlib
```

`daml/MyModule.daml`:
```daml
module MyModule where

template Counter
  with
    owner : Party
    count : Int
  where
    signatory owner
    choice Increment : ContractId Counter
      controller owner
      do create this with count = count + 1
```

Build + get the package id:
```bash
daml build --no-legacy-assistant-warning
daml damlc inspect-dar --json .daml/dist/mypkg-1.0.0.dar \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["main_package_id"])'
```
Any source change => new DAR => **new package id** (old one stays on ledger).

---

## 4. Upload the DAR

```bash
curl -sS -w "\nHTTP %{http_code}\n" -X POST "$BASE/v2/packages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @.daml/dist/mypkg-1.0.0.dar
# success = HTTP 200, body {}
```
Verify: `GET /v2/packages` -> `.packageIds` contains your package id.

---

## 5. Create a contract

```bash
curl -sS -X POST "$BASE/v2/commands/submit-and-wait" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{
  "actAs": ["<PARTY>"], "readAs": [], "userId": "6",
  "commandId": "create-123", "deduplicationPeriod": {"Empty": {}},
  "commands": [{"CreateCommand": {
    "templateId": "<PKG_ID>:MyModule:Counter",
    "createArguments": {"owner": "<PARTY>", "count": "0"}
  }}]
}'
```
Use `submit-and-wait-for-transaction` instead if you need the contractId back.

---

## 6. Exercise a choice

```bash
curl -sS -X POST "$BASE/v2/commands/submit-and-wait" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{
  "actAs": ["<PARTY>"], "readAs": [], "userId": "6",
  "commandId": "ex-123", "deduplicationPeriod": {"Empty": {}},
  "commands": [{"ExerciseCommand": {
    "templateId": "<PKG_ID>:MyModule:Counter",
    "contractId": "<CID>",
    "choice": "Increment",
    "choiceArgument": {}
  }}]
}'
```
`Archive` is an implicit choice on every template (`choiceArgument: {}`).

---

## 7. Query the ACS (current contracts)

```bash
OFFSET=$(curl -sS "$BASE/v2/state/ledger-end" -H "Authorization: Bearer $TOKEN" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["offset"])')

curl -sS -X POST "$BASE/v2/state/active-contracts" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{
  \"filter\": {\"filtersByParty\": {\"<PARTY>\": {\"cumulative\": [
    {\"identifierFilter\": {\"TemplateFilter\": {\"value\": {
      \"templateId\": \"#mypkg:MyModule:Counter\", \"includeCreatedEventBlob\": false
    }}}}]}}},
  \"verbose\": true, \"activeAtOffset\": $OFFSET
}"
```
Note `#mypkg:...` (package-name form) in the filter, see G1.
Wildcard filter (`WildcardFilter`) returns ALL of a party's contracts but 413s
past ~200 elements; prefer a `TemplateFilter`.

---

## 8. Transaction history (watch)

```bash
END=$(curl -sS "$BASE/v2/state/ledger-end" -H "Authorization: Bearer $TOKEN" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["offset"])')

curl -sS -X POST "$BASE/v2/updates/flats?limit=200" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "{
  \"beginExclusive\": 0, \"endInclusive\": $END,
  \"filter\": {\"filtersByParty\": {\"<PARTY>\": {\"cumulative\": [
    {\"identifierFilter\": {\"TemplateFilter\": {\"value\": {
      \"templateId\": \"#mypkg:MyModule:Counter\", \"includeCreatedEventBlob\": false}}}}]}}},
  \"verbose\": true
}"
```
Live push: open the WebSocket `wss://.../v2/updates/flats`, subprotocols
`daml.ws.auth` + `jwt.token.<TOKEN>`, omit `endInclusive`.

Other read endpoints: `/v2/updates/trees` (with exercise nodes),
`/v2/updates/update-by-id`, `/v2/events/events-by-contract-id` (archived-safe).

---

## 9. Add a party + grant rights

```bash
# create party (returns Bob::<fingerprint>)
curl -sS -X POST "$BASE/v2/parties" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"partyIdHint":"Bob","identityProviderId":""}'

# grant CanActAs to user 6
curl -sS -X POST "$BASE/v2/users/6/rights" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId":"6","rights":[{"kind":{"CanActAs":{"value":{"party":"Bob::<fp>"}}}}]}'
```
All parties created this way are hosted on user 6's participant and are driven
by user 6 (there is no separate login). A genuinely separate user requires Five
North to provision a new OAuth client (new `sub` -> new ledger user).

---

## 10. Multi-party contract pattern

To let several parties see and act on ONE contract, add an observer list and a
flexible-controller choice:
```daml
template SharedCounter
  with
    owner   : Party
    parties : [Party]
    count   : Int
  where
    signatory owner
    observer parties                    -- they can SEE it
    choice Bump : ContractId SharedCounter
      with actor : Party
      controller actor                  -- any caller can act
      do
        assertMsg "not a participant" (actor == owner || actor `elem` parties)
        create this with count = count + 1
```
Create with `"parties": ["Dave::..","Carol::.."]`; each of them can then
`Bump` the same contract (verified: count climbed via 3 different parties).

---

## 11. Verified reference values (this environment)

| Thing | Value |
|---|---|
| Example DAR (`test` 1.0.0) pkg | `6b69ceb08414965c49d5781b853bff31327753e9f1b65ef985eb1e417b542474` |
| `Counter` (counter 1.0.0) pkg | `b5a9312236ddbff2c34bb2237ea23ef5b82f0983e47e395612e02d50d08d1244` |
| `SharedCounter` (counter 1.1.0) pkg | `5b9a3863496b14faad4b9814156b121bf58e847be0508194a19c1d68363a7b71` |
| Parties created | `Alice::<fp>`, `Carol::<fp>`, `Dave::<fp>` (fp = `1220a14c…acf8`) |

Templates available now: `<b5a9…>:Counter:Counter` (Increment/IncrementBy/Peek)
and `<5b9a…>:Counter:SharedCounter` (Bump).

---

## 12. Scripts already in this repo

| File | What it does |
|---|---|
| `.env` | central config; auto-detects USER_ID + PRIMARY_PARTY from the token |
| `lib.sh` | bootstrap: loads `.env`, gets token, exposes `api_post` / `ledger_end` |
| `addparty.sh` | `./addparty.sh <name|partyId>`, create party + grant CanActAs |
| `shared.sh` | `create "p1,p2"` / `show` / `bump` / `history` for SharedCounter; `AS=<party>` to act as another party |
| `counter/counter.sh` | single-party Counter CLI: `show`/`create`/`inc`/`incby`/`history` |
| `counter/daml/Counter.daml` | both templates |

To reuse the scripts: only `CLIENT_ID` / `CLIENT_SECRET` in `.env` need changing
for a different credential, the rest is auto-detected.

---

## 13. Minimal mental model

```
DAR (code)  --upload-->  package id on ledger
   |                          |
   |                     templateId = pkgId:Module:Template   (commands)
   |                     templateId = #pkgName:Module:Template (filters)
   v
CreateCommand (actAs must cover signatories)  -->  contract instance (contractId)
   |                                                     |
ExerciseCommand (consuming) --> archives old, creates successor (new contractId)
   |                                                     |
ACS = active now      /      updates+events = full history (archived readable)
```
