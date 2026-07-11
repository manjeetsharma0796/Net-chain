#!/usr/bin/env bash
# NetChain, T09 on-ledger state bring-up.
#
# Makes the deployed package (pkg cdd7…55e7) into live *state*: allocates the
# demo parties, seeds the 460k→45k obligation graph (accounts + policies +
# obligations), runs ComputeNetPositions, then Settle, and queries the ACS to
# confirm the settled balances. Idempotent on party allocation (reuses existing
# hints); each run seeds a fresh cycle.
#
# Usage:  cd daml && source ../.env && ./deploy.sh
# Needs:  CLIENT_SECRET set (env or ../.env). All other values come from ../.env.
#
# Honors the E2E-guide gotchas: G1 (pkgId form for commands, #name for filters),
# G2 (Decimals as JSON strings), G3/G5 (recover cids via the ACS; actAs covers
# every signatory), G7 (node appends the ::fingerprint suffix to party hints).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-$HERE/../.env}"
# shellcheck disable=SC1090
[ -f "$ENV_FILE" ] && source "$ENV_FILE"

: "${BASE:?set BASE in ../.env}"
: "${TOKEN_ENDPOINT:?set TOKEN_ENDPOINT in ../.env}"
: "${CLIENT_ID:?set CLIENT_ID in ../.env}"
: "${CLIENT_SECRET:?set CLIENT_SECRET (env or ../.env), see OPERATOR_TODO.md}"
: "${AUDIENCE:?set AUDIENCE in ../.env}"
: "${SCOPE:?set SCOPE in ../.env}"
: "${NETCHAIN_PKG_ID:?set NETCHAIN_PKG_ID in ../.env}"
USER_ID="${USER_ID:-6}"

# templateId forms (G1): package-ID for commands, #package-name for ACS filters.
tid() { printf '%s:NetChain:%s' "$NETCHAIN_PKG_ID" "$1"; }   # command form
fid() { printf '#netchain:NetChain:%s' "$1"; }                # filter form

say() { printf '\n\033[1;36m== %s\033[0m\n' "$*"; }
die() { printf '\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

# --- auth -------------------------------------------------------------------
say "Fetching M2M token"
TOKEN=$(curl -sS -X POST "$TOKEN_ENDPOINT" \
  -d grant_type=client_credentials -d client_id="$CLIENT_ID" \
  --data-urlencode "client_secret=$CLIENT_SECRET" \
  -d audience="$AUDIENCE" -d scope="$SCOPE" \
  | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])') \
  || die "token request failed"
[ -n "$TOKEN" ] || die "empty token"

AUTH=(-H "Authorization: Bearer $TOKEN")
JSON=(-H "Content-Type: application/json")

api() { # api <path> <json-body>  -> POST, prints body, fails on .code error
  local path="$1" body="$2" out
  out=$(curl -sS -X POST "$BASE$path" "${AUTH[@]}" "${JSON[@]}" -d "$body")
  # JSON API returns errors as {"code":...,"cause":...}, surface them (G8).
  python3 - "$out" <<'PY'
import sys,json
raw=sys.argv[1]
try: d=json.loads(raw)
except Exception:
    sys.stdout.write(raw); sys.exit(0)
if isinstance(d,dict) and "code" in d and "cause" in d:
    sys.stderr.write("API error: %s\n"%raw); sys.exit(3)
sys.stdout.write(raw)
PY
}

ledger_end() {
  curl -sS "$BASE/v2/state/ledger-end" "${AUTH[@]}" \
    | python3 -c 'import sys,json;print(json.load(sys.stdin)["offset"])'
}

# --- parties (idempotent) ---------------------------------------------------
# Reuse an existing party whose id starts with "<hint>::", else allocate one.
ensure_party() {
  local hint="$1" existing
  existing=$(curl -sS "$BASE/v2/parties" "${AUTH[@]}" | python3 -c '
import sys,json
hint=sys.argv[1]
d=json.load(sys.stdin)
parties=d.get("partyDetails",d) if isinstance(d,dict) else d
for p in parties:
    pid=p.get("party","") if isinstance(p,dict) else p
    if pid.startswith(hint+"::"):
        print(pid); break
' "$hint" 2>/dev/null || true)
  if [ -n "$existing" ]; then echo "$existing"; return; fi
  api /v2/parties "{\"partyIdHint\":\"$hint\",\"identityProviderId\":\"\"}" \
    | python3 -c '
import sys,json
d=json.load(sys.stdin)
print(d.get("partyDetails",{}).get("party") or d.get("party"))'
}

grant_actas() { # let user 6 act as <party> (G6), ignore "already exists"
  local party="$1"
  curl -sS -X POST "$BASE/v2/users/$USER_ID/rights" "${AUTH[@]}" "${JSON[@]}" -d "{
    \"userId\":\"$USER_ID\",
    \"rights\":[{\"kind\":{\"CanActAs\":{\"value\":{\"party\":\"$party\"}}}}]
  }" >/dev/null 2>&1 || true
}

# Reuse caller-provided party ids (NETCHAIN_* already in .env) when set; else
# allocate a fresh party + grant CanActAs. Reuse is required on the shared devnet
# participant, where user 6 is at its user-rights cap (TOO_MANY_USER_RIGHTS) and
# cannot be granted CanActAs for newly-allocated parties, so we point at
# existing scratch parties user 6 already controls (all on the same participant
# fingerprint as the primary party).
say "Resolving parties (operator + company-a/b/c)"
resolve() { # resolve <preset-value> <hint>
  if [ -n "$1" ]; then echo "$1"; else local p; p=$(ensure_party "$2"); grant_actas "$p"; echo "$p"; fi
}
OP=$(resolve "${NETCHAIN_OPERATOR:-}"  netchain-operator);  [ -n "$OP" ] || die "operator resolve failed"
CA=$(resolve "${NETCHAIN_COMPANY_A:-}" netchain-company-a); [ -n "$CA" ] || die "company-a resolve failed"
CB=$(resolve "${NETCHAIN_COMPANY_B:-}" netchain-company-b); [ -n "$CB" ] || die "company-b resolve failed"
CC=$(resolve "${NETCHAIN_COMPANY_C:-}" netchain-company-c); [ -n "$CC" ] || die "company-c resolve failed"
printf 'operator  = %s\ncompany-a = %s\ncompany-b = %s\ncompany-c = %s\n' "$OP" "$CA" "$CB" "$CC"

# Persist party ids back into ../.env (upsert each KEY=value line).
upsert_env() { # upsert_env KEY value
  local key="$1" val="$2"
  [ -f "$ENV_FILE" ] || touch "$ENV_FILE"
  if grep -q "^$key=" "$ENV_FILE"; then
    python3 - "$ENV_FILE" "$key" "$val" <<'PY'
import sys
path,key,val=sys.argv[1:4]
lines=open(path).read().splitlines()
out=[(f"{key}={val}" if l.startswith(key+"=") else l) for l in lines]
open(path,"w").write("\n".join(out)+"\n")
PY
  else
    printf '%s=%s\n' "$key" "$val" >> "$ENV_FILE"
  fi
}
upsert_env NETCHAIN_OPERATOR  "$OP"
upsert_env NETCHAIN_COMPANY_A "$CA"
upsert_env NETCHAIN_COMPANY_B "$CB"
upsert_env NETCHAIN_COMPANY_C "$CC"
say "Wrote party ids to $ENV_FILE"

# --- create instances -------------------------------------------------------
CYCLE_ID="cyc-$(date +%s)"

create() { # create <actAs-party> <Template> <createArguments-json>
  local party="$1" tmpl="$2" args="$3"
  api /v2/commands/submit-and-wait "{
    \"actAs\":[\"$party\"],\"readAs\":[],\"userId\":\"$USER_ID\",
    \"commandId\":\"c-$tmpl-$RANDOM$RANDOM\",\"deduplicationPeriod\":{\"Empty\":{}},
    \"commands\":[{\"CreateCommand\":{\"templateId\":\"$(tid "$tmpl")\",\"createArguments\":$args}}]
  }" >/dev/null
}

# --- ACS helpers (defined before seeding so the idempotency guards can use them) ---
# Query as operator (signatory on Account/NetPosition/Cycle, observer on
# Obligation/Policy) → operator sees every contract we make.
acs() { # acs <Template>  -> prints "cid<TAB>createArgumentJSON" (compact) per contract
  local tmpl="$1" off; off=$(ledger_end)
  curl -sS -X POST "$BASE/v2/state/active-contracts" "${AUTH[@]}" "${JSON[@]}" -d "{
    \"filter\":{\"filtersByParty\":{\"$OP\":{\"cumulative\":[
      {\"identifierFilter\":{\"TemplateFilter\":{\"value\":{
        \"templateId\":\"$(fid "$tmpl")\",\"includeCreatedEventBlob\":false}}}}]}}},
    \"verbose\":true,\"activeAtOffset\":$off
  }" | python3 -c '
import sys,json
raw=sys.stdin.read()
try:
    data=json.loads(raw); entries=data if isinstance(data,list) else [data]
except Exception:
    entries=[]
    for line in raw.splitlines():
        line=line.strip()
        if not line: continue
        try: entries.append(json.loads(line))
        except Exception: pass
for e in entries:
    if not isinstance(e,dict): continue
    ce=(e.get("contractEntry",{}) or {}).get("JsActiveContract",{}).get("createdEvent",{})
    if not ce: continue
    print(ce.get("contractId","")+"\t"+json.dumps(ce.get("createArgument",{}),separators=(",",":")))'
}
newest() { tail -n "$1"; }                    # ACS returns oldest→newest ordering
count() { acs "$1" | grep -c . || true; }     # active-contract count for a template

# Idempotent seeding: only create if the ACS doesn't already hold a full set,
# so a re-run reuses what a prior (possibly partial) run created rather than
# piling up duplicate contracts.
if [ "$(count Account)" -ge 3 ]; then
  say "Accounts already present ($(count Account)), skipping seed"
else
  say "Seeding 3 Accounts (100k each, actAs operator)"
  for owner in "$CA" "$CB" "$CC"; do
    create "$OP" Account "{\"operator\":\"$OP\",\"owner\":\"$owner\",\"balance\":\"100000.0\"}"
  done
fi

if [ "$(count TreasuryPolicy)" -ge 3 ]; then
  say "TreasuryPolicies already present ($(count TreasuryPolicy)), skipping seed"
else
  say "Seeding 3 TreasuryPolicies (caps A=200k B=500k C=350k)"
  create "$CA" TreasuryPolicy "{\"operator\":\"$OP\",\"party\":\"$CA\",\"maxSettlementPerCycle\":\"200000.0\"}"
  create "$CB" TreasuryPolicy "{\"operator\":\"$OP\",\"party\":\"$CB\",\"maxSettlementPerCycle\":\"500000.0\"}"
  create "$CC" TreasuryPolicy "{\"operator\":\"$OP\",\"party\":\"$CC\",\"maxSettlementPerCycle\":\"350000.0\"}"
fi

if [ "$(count Obligation)" -ge 6 ]; then
  say "Obligations already present ($(count Obligation)), skipping seed"
else
  say "Seeding 6 Obligations (gross 460k → net 45k)"
  # obligor obligee amount ref  (actAs = obligor, the signatory)
  obl() { create "$1" Obligation \
    "{\"operator\":\"$OP\",\"obligor\":\"$1\",\"obligee\":\"$2\",\"amount\":\"$3\",\"reference\":\"$4\",\"dueDate\":\"2026-07-20\",\"settled\":false,\"source\":null,\"uetr\":null}"; }
  obl "$CA" "$CB" 120000.0 "AB"
  obl "$CB" "$CC"  95000.0 "BC"
  obl "$CC" "$CA" 150000.0 "CA"
  obl "$CA" "$CC"  40000.0 "AC"
  obl "$CB" "$CA"  25000.0 "BA"
  obl "$CC" "$CB"  30000.0 "CB"
fi

say "Collecting obligation contract ids"
OBL_CIDS=$(acs Obligation | newest 6 | cut -f1 | tr '\n' ' ')
[ -n "$OBL_CIDS" ] || die "no obligations found in ACS"
OBL_JSON=$(python3 -c 'import sys,json;print(json.dumps(sys.argv[1].split()))' "$OBL_CIDS")

CYC_CID=$(acs NettingCycle | grep '"settled":false' | tail -n1 | cut -f1)
if [ -n "$CYC_CID" ]; then
  say "Reusing existing unsettled NettingCycle"
else
  say "Creating NettingCycle over the 6 obligations"
  create "$OP" NettingCycle \
    "{\"operator\":\"$OP\",\"participants\":[\"$CA\",\"$CB\",\"$CC\"],\"obligationCids\":$OBL_JSON,\"settled\":false}"
  CYC_CID=$(acs NettingCycle | grep '"settled":false' | tail -n1 | cut -f1)
fi
[ -n "$CYC_CID" ] || die "netting cycle cid not found"

exercise() { # exercise <actAs> <Template> <cid> <choice> <arg-json>
  api /v2/commands/submit-and-wait "{
    \"actAs\":[\"$1\"],\"readAs\":[],\"userId\":\"$USER_ID\",
    \"commandId\":\"x-$4-$RANDOM$RANDOM\",\"deduplicationPeriod\":{\"Empty\":{}},
    \"commands\":[{\"ExerciseCommand\":{\"templateId\":\"$(tid "$2")\",\"contractId\":\"$3\",\"choice\":\"$4\",\"choiceArgument\":$5}}]
  }" >/dev/null
}

say "Exercising ComputeNetPositions"
exercise "$OP" NettingCycle "$CYC_CID" ComputeNetPositions "{\"cycleId\":\"$CYCLE_ID\"}"

say "Collecting NetPosition / Account / Policy cids for Settle"
NP_CIDS=$(acs NetPosition | newest 3 | cut -f1 | tr '\n' ' ')
ACC_CIDS=$(acs Account   | grep -F "\"balance\":\"100000.0000000000\"" | tail -n 3 | cut -f1 | tr '\n' ' ')
# Balance may serialize as 100000.0 or 100000.0000000000 depending on node; fall back.
[ -n "$ACC_CIDS" ] || ACC_CIDS=$(acs Account | newest 3 | cut -f1 | tr '\n' ' ')
POL_CIDS=$(acs TreasuryPolicy | newest 3 | cut -f1 | tr '\n' ' ')
to_json() { python3 -c 'import sys,json;print(json.dumps(sys.argv[1].split()))' "$1"; }

# NettingCycle is nonconsuming for ComputeNetPositions; re-find the unsettled cycle.
CYC_CID=$(acs NettingCycle | grep '"settled":false' | tail -n1 | cut -f1)

say "Exercising Settle (atomic DvP)"
exercise "$OP" NettingCycle "$CYC_CID" Settle "{
  \"cycleId\":\"$CYCLE_ID\",
  \"netPositionCids\":$(to_json "$NP_CIDS"),
  \"accountCids\":$(to_json "$ACC_CIDS"),
  \"policyCids\":$(to_json "$POL_CIDS")
}"

# --- confirm ----------------------------------------------------------------
say "Post-Settle Account balances (expect A=115k B=130k C=55k)"
acs Account | python3 -c '
import sys,json
want={"'"$CA"'":"A","'"$CB"'":"B","'"$CC"'":"C"}
seen={}
for line in sys.stdin:
    cid,_,arg=line.partition("\t")
    try: a=json.loads(arg)
    except Exception: continue
    o=a.get("owner")
    if o in want: seen[o]=a.get("balance")
for pid,label in want.items():
    val=seen.get(pid) or "(n/a)"
    print(f"  Company {label}: {val} USDCx")'

say "Per-party NetPositions (expect A +15k, B +30k, C -45k; sum 0)"
acs NetPosition | python3 -c '
import sys,json
want={"'"$CA"'":"A","'"$CB"'":"B","'"$CC"'":"C"}
tot=0.0
rows={}
for line in sys.stdin:
    cid,_,arg=line.partition("\t")
    try: a=json.loads(arg)
    except Exception: continue
    p=a.get("party")
    if p in want: rows[p]=a.get("net")
for pid,label in want.items():
    v=rows.get(pid)
    if v is not None: tot+=float(v)
    print(f"  Company {label}: {v} USDCx")
print(f"  Σ nets = {tot:g} (zero by construction)")'

say "T09 done, on-ledger state is live and queryable via the JSON Ledger API."
