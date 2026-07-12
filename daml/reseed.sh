#!/usr/bin/env bash
# NetChain, one-command demo RESET (judging safeguard).
#
# The public prod URL runs LIVE and writable, so any visitor can create/accept/
# settle and mutate the seeded demo. This restores the clean, re-runnable OPEN
# state in one command: balances 100k/100k/100k, exactly the 6 canonical
# obligations (gross 460k), all ACCEPTED so they net, and NO settle.
#
# Unlike deploy.sh (idempotent-by-count, skips when contracts exist), reseed.sh
# FORCES the clean state: it archives whatever is there first, then re-seeds.
#
# Usage:  cd daml && source ../.env && ./reseed.sh
# Needs:  the same .env as deploy.sh (CLIENT_SECRET etc.) and NETCHAIN_PKG_ID
#         pointing at the live package. Reuses the party ids in .env.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-$HERE/../.env}"
# shellcheck disable=SC1090
[ -f "$ENV_FILE" ] && source "$ENV_FILE"

: "${BASE:?set BASE in ../.env}"
: "${TOKEN_ENDPOINT:?set TOKEN_ENDPOINT}"; : "${CLIENT_ID:?}"; : "${CLIENT_SECRET:?}"
: "${AUDIENCE:?}"; : "${SCOPE:?}"; : "${NETCHAIN_PKG_ID:?set NETCHAIN_PKG_ID}"
: "${NETCHAIN_OPERATOR:?run deploy.sh once first}"; : "${NETCHAIN_COMPANY_A:?}"
: "${NETCHAIN_COMPANY_B:?}"; : "${NETCHAIN_COMPANY_C:?}"
USER_ID="${USER_ID:-6}"

# python3 or python (this Windows box only has `python`).
PY="$(command -v python3 || command -v python)"; : "${PY:?need python}"

say() { printf '\n\033[1;36m== %s\033[0m\n' "$*"; }
OP="$NETCHAIN_OPERATOR"; CA="$NETCHAIN_COMPANY_A"; CB="$NETCHAIN_COMPANY_B"; CC="$NETCHAIN_COMPANY_C"
tid() { printf '%s:NetChain:%s' "$NETCHAIN_PKG_ID" "$1"; }
fid() { printf '#netchain:NetChain:%s' "$1"; }

say "Fetching M2M token"
TOKEN=$(curl -sS -X POST "$TOKEN_ENDPOINT" \
  -d grant_type=client_credentials -d client_id="$CLIENT_ID" \
  --data-urlencode "client_secret=$CLIENT_SECRET" \
  -d audience="$AUDIENCE" -d scope="$SCOPE" \
  | "$PY" -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')
[ -n "$TOKEN" ] || { echo "empty token" >&2; exit 1; }
AUTH=(-H "Authorization: Bearer $TOKEN"); JSON=(-H "Content-Type: application/json")

ledger_end() { curl -sS "$BASE/v2/state/ledger-end" "${AUTH[@]}" | "$PY" -c 'import sys,json;print(json.load(sys.stdin)["offset"])'; }

# acs <Template> -> "cid<TAB>createArgJSON" per active contract (operator view).
acs() {
  local off; off=$(ledger_end)
  curl -sS -X POST "$BASE/v2/state/active-contracts" "${AUTH[@]}" "${JSON[@]}" -d "{
    \"filter\":{\"filtersByParty\":{\"$OP\":{\"cumulative\":[
      {\"identifierFilter\":{\"TemplateFilter\":{\"value\":{
        \"templateId\":\"$(fid "$1")\",\"includeCreatedEventBlob\":false}}}}]}}},
    \"verbose\":true,\"activeAtOffset\":$off
  }" | "$PY" -c '
import sys,json
raw=sys.stdin.read()
try: entries=json.loads(raw); entries=entries if isinstance(entries,list) else [entries]
except Exception:
    entries=[json.loads(l) for l in raw.splitlines() if l.strip()]
for e in entries:
    if not isinstance(e,dict): continue
    ce=(e.get("contractEntry",{}) or {}).get("JsActiveContract",{}).get("createdEvent",{})
    if ce: print(ce.get("contractId","")+"\t"+json.dumps(ce.get("createArgument",{}),separators=(",",":")))'
}

# submit <actAs> <commandsJSON>
submit() {
  curl -sS -X POST "$BASE/v2/commands/submit-and-wait" "${AUTH[@]}" "${JSON[@]}" -d "{
    \"actAs\":[\"$1\"],\"readAs\":[],\"userId\":\"$USER_ID\",
    \"commandId\":\"reseed-$RANDOM$RANDOM\",\"deduplicationPeriod\":{\"Empty\":{}},
    \"commands\":[$2]
  }" >/dev/null
}
create()   { submit "$1" "{\"CreateCommand\":{\"templateId\":\"$(tid "$2")\",\"createArguments\":$3}}"; }
archive()  { submit "$1" "{\"ExerciseCommand\":{\"templateId\":\"$(tid "$2")\",\"contractId\":\"$3\",\"choice\":\"Archive\",\"choiceArgument\":{}}}"; }

# field <json> <key> -> value
field() { printf '%s' "$1" | "$PY" -c 'import sys,json;print(json.load(sys.stdin).get(sys.argv[1],""))' "$2"; }

# --- 1. archive stale cycle state + all obligations -------------------------
say "Archiving NetPositions / NettingCycles (operator)"
acs NetPosition | while IFS=$'\t' read -r cid _; do [ -n "$cid" ] && archive "$OP" NetPosition "$cid" || true; done
acs NettingCycle | while IFS=$'\t' read -r cid _; do [ -n "$cid" ] && archive "$OP" NettingCycle "$cid" || true; done

say "Archiving all Obligations (as obligor)"
acs Obligation | while IFS=$'\t' read -r cid payload; do
  [ -n "$cid" ] || continue
  archive "$(field "$payload" obligor)" Obligation "$cid"
done

# --- 2. reset accounts to 100k ----------------------------------------------
say "Resetting Accounts to 100k (archive + recreate, operator)"
acs Account | while IFS=$'\t' read -r cid _; do [ -n "$cid" ] && archive "$OP" Account "$cid" || true; done
for owner in "$CA" "$CB" "$CC"; do
  create "$OP" Account "{\"operator\":\"$OP\",\"owner\":\"$owner\",\"balance\":\"100000.0\"}"
done

# --- 3. ensure policies (caps A=200k B=500k C=350k) -------------------------
if [ "$(acs TreasuryPolicy | grep -c . || true)" -ge 3 ]; then
  say "TreasuryPolicies present, keeping"
else
  say "Seeding TreasuryPolicies (A=200k B=500k C=350k)"
  create "$CA" TreasuryPolicy "{\"operator\":\"$OP\",\"party\":\"$CA\",\"maxSettlementPerCycle\":\"200000.0\"}"
  create "$CB" TreasuryPolicy "{\"operator\":\"$OP\",\"party\":\"$CB\",\"maxSettlementPerCycle\":\"500000.0\"}"
  create "$CC" TreasuryPolicy "{\"operator\":\"$OP\",\"party\":\"$CC\",\"maxSettlementPerCycle\":\"350000.0\"}"
fi

# --- 4. seed the 6 canonical obligations, ACCEPTED so they net --------------
say "Seeding 6 Obligations (gross 460k, accepted=true)"
obl() { create "$1" Obligation \
  "{\"operator\":\"$OP\",\"obligor\":\"$1\",\"obligee\":\"$2\",\"amount\":\"$3\",\"reference\":\"$4\",\"dueDate\":\"2026-07-20\",\"settled\":false,\"source\":null,\"uetr\":null,\"accepted\":true}"; }
obl "$CA" "$CB" 120000.0 "AB"
obl "$CB" "$CC"  95000.0 "BC"
obl "$CC" "$CA" 150000.0 "CA"
obl "$CA" "$CC"  40000.0 "AC"
obl "$CB" "$CA"  25000.0 "BA"
obl "$CC" "$CB"  30000.0 "CB"

# --- 5. report --------------------------------------------------------------
say "Final state"
printf 'Accounts:     %s\n' "$(acs Account | grep -c . || true)"
printf 'Obligations:  %s (all accepted, gross 460k)\n' "$(acs Obligation | grep -c . || true)"
printf 'Policies:     %s\n' "$(acs TreasuryPolicy | grep -c . || true)"
printf 'NetPositions: %s   NettingCycles: %s (should be 0 / 0, open demo)\n' \
  "$(acs NetPosition | grep -c . || true)" "$(acs NettingCycle | grep -c . || true)"
echo "reseed done. Demo is clean and OPEN (not settled)."
