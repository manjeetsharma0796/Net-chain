# Redeploying a rebuilt Daml contract

This box can't run `dpm` (Windows), so the DAR has to come from CI. The
`daml` workflow (`.github/workflows/daml.yml`) builds it and uploads it as a
workflow artifact named `netchain-dar`. This is the loop to get a Daml
change (e.g. T48, T34, T40) from source to live on-ledger + in the frontend.

Changing the contract source always produces a **new package id**, the old
package stays on the ledger under its old id, it does not get overwritten.
Every step below that references a package id is there because of that.

## Steps

1. **Push the Daml change.** Any push touching `daml/**` triggers the
   `daml` workflow: `dpm build` then the new `Upload DAR artifact` step
   (`actions/upload-artifact@v4`), then `dpm test`. Wait for the run to go
   green.

2. **Download the artifact (human step).** Open the workflow run on GitHub
   → Actions tab → the `netchain-dar` artifact → download and unzip. You get
   `netchain-1.0.0.dar`. GitHub Actions artifacts need a browser/`gh` auth;
   this is a human/outward-facing step, not something to script here.

3. **Upload the DAR to Devnet.**
   ```bash
   cd daml && source ../.env
   TOKEN=$(curl -s -X POST "$TOKEN_ENDPOINT" \
     -d grant_type=client_credentials -d client_id="$CLIENT_ID" \
     --data-urlencode "client_secret=$CLIENT_SECRET" \
     -d audience="$AUDIENCE" -d scope="$SCOPE" \
     | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')

   curl -s -w "\n%{http_code}\n" -X POST "$BASE/v2/packages" \
     -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/octet-stream" \
     --data-binary @/path/to/downloaded/netchain-1.0.0.dar
   # success = HTTP 200, body {}
   ```
   This step touches the shared devnet credential, also a human step.

4. **Get the new main package id**, either:
   - locally, if you have the DAR: `dpm inspect-dar --json netchain-1.0.0.dar
     | python3 -c 'import sys,json;print(json.load(sys.stdin)["main_package_id"])'`
   - or from the CI log, add a `dpm inspect-dar` line to the workflow if it
     isn't already printed (not currently in `daml.yml`, read it off a local
     `dpm inspect-dar` run against the downloaded DAR instead).

5. **Point the app at the new package id (human step, secrets).**
   - Update `NETCHAIN_PKG_ID` in the untracked `../.env`.
   - Update `NETCHAIN_PKG_ID` in Vercel's project environment variables and
     redeploy the frontend. Every `templateId` the frontend sends
     (`<PKG_ID>:NetChain:<Template>`) must use the new id or commands will
     hit the old, stale package.

6. **Seed on-ledger state under the new package.**
   ```bash
   cd daml && source ../.env && ./deploy.sh
   ```
   `deploy.sh` reuses existing parties from `.env` (`NETCHAIN_OPERATOR` /
   `_COMPANY_A/B/C`) and is idempotent per-template, so re-running after a
   package bump seeds fresh `Account`/`Obligation`/etc. instances under the
   new `NETCHAIN_PKG_ID`. Note the old package's contracts are still on the
   ledger (nothing is deleted) but they carry the old package id in their
   `templateId`, so old and new instances don't mix; the app only sees the
   new ones once `NETCHAIN_PKG_ID` is updated everywhere in step 5.

## Reference

- Upload details, gotchas (G1 templateId forms, G2 decimal-as-string, etc.):
  `docs/CANTON_E2E_GUIDE.md`.
- Build/deploy commands, template/field reference: `daml/README.md`.
- Seeding script: `daml/deploy.sh`.
