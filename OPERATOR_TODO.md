# NetChain — Operator TODO

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

- [!] **Configure a git remote.** This clone has **no `origin`** (`git remote -v` is empty),
  so the branch `daml-interaction` cannot be pushed and no PR can be opened from here. Add
  the GitHub remote (`git remote add origin <url>`) or push from a checkout that has one.
  All work is committed locally on `daml-interaction` and is ready to push once a remote exists.

## Decisions (resolved)

- [x] **Party allocation:** fresh `netchain-*` parties could **not** be authorized — the shared
  M2M user (6) is at its **1000 user-rights cap** (`TOO_MANY_USER_RIGHTS`), so no new `CanActAs`
  grants are possible. Per your approval, the demo **reuses existing scratch parties** user 6
  already controls, all on the primary participant fingerprint: operator=`Dave`, A=`Carol`,
  B=`Investor`, C=`SME`. These are written into the untracked `.env` (`NETCHAIN_OPERATOR` etc.).
  A dedicated OAuth client from Five North would let you switch back to named `netchain-*` parties.
- [ ] **Cosmetic — duplicate contracts:** one buggy re-seed created a 2× set (settlement still
  landed correctly; privacy holds). `deploy.sh` is now idempotent, but the ACS still holds the
  duplicates, so the live obligations table shows each row twice. Options: leave it (functionally
  fine), archive the extras, or run the pixel-perfect demo on the mock (`NEXT_PUBLIC_LEDGER_LIVE=0`).
- [ ] Confirm the **real deadline** (13 vs 14 Jul) in `#canton`.

## Ship

- [ ] Once a remote exists: push `daml-interaction`, review the **draft PR**, merge, delete branch.
- [ ] (Later, out of scope) Vercel env for T15 live frontend link.

## Environment notes (for whoever runs the live path)

- Run the deploy: `cd daml && source ../.env && ./deploy.sh` (needs `CLIENT_SECRET` set first).
- Run the live frontend: set `NEXT_PUBLIC_LEDGER_LIVE=1` (client flag) **and** the server-side
  `.env` values (`CLIENT_SECRET`, party ids, `NETCHAIN_PKG_ID`), then `npm run dev`. With the
  flag unset, the app runs the original mock demo — nothing hard-breaks.
- Local DPM install in this container was **not** attempted as the source of truth — CI
  (`.github/workflows/daml.yml`) builds and tests the DAR on Linux. Install locally only if you
  want `dpm test` on your own machine.
