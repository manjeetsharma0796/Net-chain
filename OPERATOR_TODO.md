# NetChain, Operator TODO

Human-only actions and decisions for the DAML-interaction spine (T09 + T11–T14).
Everything an agent **cannot** do itself lives here. Check items off as you go.

> Status legend: `[ ]` open · `[x]` done · `[!]` **blocking** the live path.

## Live status (2026-07-10)

- [x] **`CLIENT_SECRET` provided and working.** Token exchange + authenticated calls succeed.
- [x] **T09 is LIVE.** `deploy.sh` ran end-to-end: settled balances **A=115k, B=130k, C=55k**
      and NetPositions **A +15k, B +30k, C −45k (sum 0)**, read back from the ACS.
- [x] **All four wins verified live** through the Next.js route handlers (with
      `NEXT_PUBLIC_LEDGER_LIVE=1`): privacy (C gets 404 on the A→B contract, A gets 200),
      per-party net position, and the on-ledger policy gate (250k → `AssertionFailed`, 150k → ok).

- [x] **Shipped from a local checkout (2026-07-10).** The cloud container had no `origin`; the
  branch was delivered as a git bundle, fetched into the local clone (which has the GitHub
  remote), verified, pushed, and merged. **PR #1 merged to `main`; branch deleted.** CI
  (`daml.yml`) went green on Linux, `dpm build` + `dpm test` = 4 Script tests pass.

## Decisions (resolved)

- [x] **Party allocation:** fresh `netchain-*` parties could **not** be authorized, the shared
  M2M user (6) is at its **1000 user-rights cap** (`TOO_MANY_USER_RIGHTS`), so no new `CanActAs`
  grants are possible. Per your approval, the demo **reuses existing scratch parties** user 6
  already controls, all on the primary participant fingerprint: operator=`Dave`, A=`Carol`,
  B=`Investor`, C=`SME`. These are written into the untracked `.env` (`NETCHAIN_OPERATOR` etc.).
  A dedicated OAuth client from Five North would let you switch back to named `netchain-*` parties.
- [x] **Duplicate contracts archived (2026-07-10).** Archived the 6 duplicate `Obligation`s
  (kept one per pair → 6) and the 3 stale @100k `Account`s (kept the settled 115k/130k/55k), so
  the live obligations table is clean. The 3 duplicate `TreasuryPolicy`s were left, invisible and
  harmless (`checkPolicy` uses `.find`, which returns the first). `deploy.sh` is idempotent so
  this won't recur.
- [ ] Confirm the **real deadline** (13 vs 14 Jul) in `#canton`.

## Ship

- [x] Push `daml-interaction`, open PR, merge to `main`, delete branch, **done (PR #1)**.
- [ ] (Later, out of scope) Vercel env for T15 live frontend link.

## Frontend pipeline (activate the new tooling)

- [!] **Restart Claude Code** to connect the new MCP servers (`.mcp.json`: 21st.dev `magic`,
  `playwright`) and load the vendored `ui-ux-pro-max` skills. They do not activate mid-session.
- [!] **Export `TWENTYFIRST_API_KEY`** in your shell before launching Claude Code so the `magic`
  MCP can authenticate (the value is in the untracked `.env`; `.mcp.json` only references it).
- [ ] **Install Python 3** if you want the `ui-ux-pro-max` search script (it is not on this box).
  The skill's reference data still reads without it; only the search helper needs Python.
- Playwright is installed (`@playwright/test` + Chromium). Live audit (2026-07-11, re-verified after
  the T48 redeploy): the obligations page shows the real per-party ledger projection (company-a = 4
  rows), and the dashboard USDCx balance card **does render the live on-ledger value (115,000.00 for
  company-a)** with the "Live on-ledger balance" caption. An earlier audit reading 512,400 was a
  `NumberTicker` timing artifact, it animates from the mock initial value before `getBalanceLive`
  resolves, then settles on the live number. No mock fix needed there.

## Rule compliance (needs your decision)

- [!] **6 commits on `main` are authored by "Claude"** (the PR #1 cloud-session commits:
  `549adaf`, `c7fd5db`, `f0cc16a`, `e2361bf`, `9da9a50`, `12708a4`). This violates the
  "no Claude as contributor" rule. Fixing it means **rewriting shared `main` history**
  (`git rebase`/`filter-repo` + force-push), which is destructive and can disrupt anyone who
  has pulled. I will NOT do this without your explicit go-ahead. New commits are authored by
  `jishnu-baruah`, so no new violations. Options: leave it, or approve a history rewrite of
  the author on those 6 commits.
- [ ] Em-dashes are pervasive in existing docs/source (~200+, predating the rule). Tracked as
  T43 (per-line reword, not a blind sed). New writing is em-dash free.

## Redeploy the settlement correctness fix (DONE except one Vercel step)

- [x] **T48 redeploy is LIVE (2026-07-11).** The correctness fix is now vetted and running on
  Devnet. What was done:
  - Reworked the fix to be a **valid Canton Smart Contract Upgrade** of the deployed `v1.0.0`
    (the first attempt failed `NOT_VALID_UPGRADE_PACKAGE` because it removed choice input fields).
    v1.0.1 keeps every `v1.0.0` choice signature + template field and changes only choice bodies
    plus the added `MarkSettled` choice. CI green (8 Daml tests).
  - Uploaded `netchain-1.0.1.dar` via `POST /v2/packages` (HTTP 200). **New package id
    `8d20d87f559db4870eec133bb9be1c1b0b4a20aa9c2c70f227597f8ffd6e8254`** (supersedes `cdd7…55e7`).
  - Updated `NETCHAIN_PKG_ID` in `.env` to the new id.
  - **Reset + re-seeded live state under v1.0.1** and settled one clean cycle. Verified via ACS:
    Accounts **A=115k, B=130k, C=55k**, all 6 Obligations **settled=true** (the C1 fix, proven live),
    NetPositions archived by Settle, cycle replay-guarded. The old buggy state (which had drifted to
    A=130k/B=160k/C=10k from repeated re-netting) was archived first.
- [x] **Vercel env updated + redeployed (2026-07-11).** You provided a Vercel CLI token, so this is
  done: `NETCHAIN_PKG_ID` in the production env is now the v1.0.1 id, and a fresh production deploy
  is live at **https://netchain.vercel.app**. Verified in a real browser: `/api/ledger/balances`
  returns `{a:115000,b:130000,c:55000}`, company-a's obligations all read `settled`, and the
  dashboard renders the live 115,000.00 balance with the LIVE badge. (Production already had the full
  live-path env set: `NEXT_PUBLIC_LEDGER_LIVE`, `CLIENT_SECRET`, party ids, etc.)
- T34/T40 (privacy refinement, source badge) were the other changes waiting on this redeploy and
  are now unblocked (they ship on the same v1.0.1 package).

## Machine note (this Windows dev box)

- [!] **Global npm is broken.** `npm install` fails with `SyntaxError: Invalid or unexpected
  token`, npm's own bundled `tar` module (`C:\Program Files\nodejs\node_modules\npm\node_modules\tar\dist\commonjs\pack.js`)
  is corrupted (overwritten with hex data). Workaround used here: install deps via
  `corepack pnpm install` (npm's script runner still works, so `npm run build`/`dev` are fine
  once `node_modules` exists). **Fix:** reinstall Node.js/npm to repair the corrupted file.

## Environment notes (for whoever runs the live path)

- Run the deploy: `cd daml && source ../.env && ./deploy.sh` (needs `CLIENT_SECRET` set first).
- Run the live frontend: set `NEXT_PUBLIC_LEDGER_LIVE=1` (client flag) **and** the server-side
  `.env` values (`CLIENT_SECRET`, party ids, `NETCHAIN_PKG_ID`), then `npm run dev`. With the
  flag unset, the app runs the original mock demo, nothing hard-breaks.
- Local DPM install in this container was **not** attempted as the source of truth, CI
  (`.github/workflows/daml.yml`) builds and tests the DAR on Linux. Install locally only if you
  want `dpm test` on your own machine.

## Real-user onboarding paths (from the 2026-07-12 wallet/provisioning research)

NetChain today is single-tenant (one shared M2M token acts as all parties). To support REAL users
with their own on-ledger parties, the options below are blocked on external/infra, not on our code:

1. **Raise `max-rights-per-user` on the shared devnet participant (ask Five North).** The M2M user is
   at its 1000 user-rights cap (`TOO_MANY_USER_RIGHTS`), which blocks provisioning new parties. Raising
   this config value (documented, precedented, a Splice validator hit the same cap) unblocks real party
   provisioning + per-user auth with no wallet work. Pragmatic near-term unlock.
2. **Loop wallet (Five North) connect** is public (`@fivenorth/loop-sdk`: `connect()` returns the user's
   `party_id`, per-tx approval), BUT the SDK only submits against Splice + Five North's "Utility app" DAR
   files, "no plan" for third-party DARs, so it cannot drive NetChain's own contracts today. Needs Five
   North to open third-party DAR support. Track it.
3. **CIP-0103 dApp API** (approved Jan 2026, an EIP-1193 analog) plus Canton external-signing / interactive
   submission is the correct long-term architecture (user signs with their own key), via
   `splice-wallet-kernel`. A multi-week integration, not a hackathon patch.

Shipped instead (now): a self-serve **sandbox** ("Try it yourself", `/onboard`) that runs the full flow
client-side per session, so any visitor can experience the product without provisioning.
