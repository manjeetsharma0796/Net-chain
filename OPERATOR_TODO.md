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
- Playwright is installed (`@playwright/test` + Chromium). Live audit (2026-07-11): the obligations
  page shows the real per-party ledger projection (company-a = 4 rows), but the dashboard USDCx
  balance still renders the mock value (512,400 vs live 115k), which is task **T27**.

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

## Redeploy the settlement correctness fix (your decision)

- [!] **T48 is fixed in source and CI-green, but not live yet.** A correctness review found the
  deployed `Settle` never marked obligations settled (so repeated cycles re-net paid debts) and had
  no replay guard. The fix is merged and validated (7 Daml tests pass), and CI now publishes the
  built DAR as the `netchain-dar` artifact. To make it live, follow `docs/REDEPLOY.md`: download the
  artifact, upload via `POST /v2/packages`, update `NETCHAIN_PKG_ID` in `.env` and Vercel, and re-run
  `deploy.sh`. This is outward-facing: it mints a NEW package id, re-seeds the live demo state, and
  the frontend must repoint, so I did not trigger it unprompted this close to the deadline. Say the
  word and I will run the parts I can (upload + re-seed) and hand you the Vercel env change.
- The current live demo still works for a single run; the bug only shows on a second cycle. T34/T40
  (privacy refinement, source badge) are the other changes waiting on this same redeploy.

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
