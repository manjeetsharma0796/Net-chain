# NetChain, Daml package

Privacy-preserving multilateral netting + atomic settlement.
**5 templates, keyless, SDK 3.5.2 / LF 2.3. Deployed live on the 5N Devnet validator.**

## Status (2026-07-10)

- ✅ Templates, `daml/NetChain.daml`: `Account`, `Obligation`, `TreasuryPolicy`,
  `NetPosition`, `NettingCycle`
- ✅ Tests, `daml/Test.daml`: 4 Daml Script tests, **all pass** (`dpm test`). They prove
  the 3 on-ledger wins:
  - `test_counterparty_privacy`, C cannot see A→B (per-party projection)
  - `test_atomic_settlement`, every balance moves in one commit
  - `test_settlement_atomic_abort`, over-cap → whole commit reverts (nothing moves)
  - `test_policy_rejects_over_threshold`, 250k > 200k cap fails on-ledger
- ✅ Deployed, **package id `cdd76816c72bba50c880ea7f8d48c9f78ae5d37e48706aa012cfeac80ee655e7`**
  live on Devnet (`POST /v2/packages` → HTTP 200; present in `GET /v2/packages`).
  **PV35 gate passed**, the validator accepts LF 2.3.
- ⬜ On-ledger demo *state* (parties + instances + cycle/settle), see **Remaining**.

## Toolchain (one-time)

```bash
# DPM + SDK 3.5.2
curl https://get.digitalasset.com/install/install.sh | sh
dpm install 3.5.2
# Java (only needed to RUN `dpm test`)
brew install openjdk
```

## Build & test

```bash
export PATH="$HOME/.dpm/bin:/opt/homebrew/opt/openjdk/bin:$PATH"
export DAML_PACKAGE="$(git rev-parse --show-toplevel)/daml"
dpm install                 # resolve deps (first time / after daml.yaml change)
dpm build                   # -> daml/.daml/dist/netchain-1.0.0.dar
dpm test                    # runs Test.daml, expect 4 ok
```

## Deploy (upload the DAR)

Needs a JWT, set `CLIENT_SECRET` in an untracked `../.env` (copy `../.env.example`).
Full API details + gotchas: [`../docs/CANTON_E2E_GUIDE.md`](../docs/CANTON_E2E_GUIDE.md).

```bash
source ../.env
TOKEN=$(curl -s -X POST "$TOKEN_ENDPOINT" \
  -d grant_type=client_credentials -d client_id="$CLIENT_ID" \
  --data-urlencode "client_secret=$CLIENT_SECRET" \
  -d audience="$AUDIENCE" -d scope="$SCOPE" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')

curl -s -w "\n%{http_code}\n" -X POST "$BASE/v2/packages" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/octet-stream" \
  --data-binary @.daml/dist/netchain-1.0.0.dar          # success = HTTP 200 {}

# package id (rebuild → new id):
dpm inspect-dar --json .daml/dist/netchain-1.0.0.dar \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["main_package_id"])'
```

## Frozen model (for the frontend, T11)

`templateId` for JSON API **commands** = `<PKG_ID>:NetChain:<Template>`; for **filters**
(ACS/updates) = `#netchain:NetChain:<Template>`. Decimals are JSON **strings**
(`"100000.0"`). `actAs` must include every signatory you write into a payload.

| Template | Fields | Signatory | Observer | Choices |
|----------|--------|-----------|----------|---------|
| `Account` | operator, owner, balance | operator | owner | none |
| `Obligation` | operator, obligor, obligee, amount, reference, dueDate, settled | obligor | obligee, operator | none |
| `TreasuryPolicy` | operator, party, maxSettlementPerCycle | party | operator | `CheckSettlement(amount)` |
| `NetPosition` | operator, party, cycleId, net | operator | party | none |
| `NettingCycle` | operator, participants, obligationCids, settled | operator | participants | `ComputeNetPositions(cycleId)→[NetPosition]`, `CheckFunding(netPositionCids, accountCids)→[Party]` (T23, underfunded payers), `ComputeNetPositionsExcluding(cycleId, excluded)→[NetPosition]` (T24, drop-and-re-net), `Settle(cycleId, netPositionCids, accountCids, policyCids)` |

**Settlement model:** the `operator` is the netting bank, it holds all `Account`s and
runs `Settle` (controller `operator`). One shared M2M token `actAs` all parties, so no
propose/accept or allocation contracts are needed.

## Remaining, T09 on-ledger run (for whoever continues DAML)

Make live *state*, not just the package. Script this as `deploy.sh`:

1. **Allocate parties** (`POST /v2/parties`): `netchain-operator`, `netchain-company-a/b/c`;
   grant `CanActAs` to user 6 (see guide §9). Save the party ids into `../.env`.
2. **Create instances** (`POST /v2/commands/submit-and-wait-for-transaction`):
   3 `Account` (actAs operator), 3 `TreasuryPolicy` (actAs each company),
   6 `Obligation` (actAs each obligor), the 460k→45k graph from `Test.daml`.
3. **Exercise** `ComputeNetPositions` then `Settle` (actAs operator).
4. **Query** the ACS (`POST /v2/state/active-contracts`) to confirm NetPositions/Accounts.

## Cleanup before final submission

Split `Test.daml` into its own package so the deployed DAR doesn't bundle `daml-script`
(harmless bloat today; the build warns about it).
