# NetChain — Operator TODO

Human-only actions and decisions for the DAML-interaction spine (T09 + T11–T14).
Everything an agent **cannot** do itself lives here. Check items off as you go.

> Status legend: `[ ]` open · `[x]` done · `[!]` **blocking** the live path.

## Blocking the live run (do these to unblock W2)

- [!] **Provide `CLIENT_SECRET` to this environment.** The remote container has **no**
  `.env` secret and no `CLIENT_SECRET` env var. Without it, `daml/deploy.sh` and the live
  frontend cannot authenticate. Two ways:
  1. Set `CLIENT_SECRET` as an environment secret/variable on the Claude-Code-on-web
     environment (preferred — never touches git), **or**
  2. Paste it into the untracked `.env` at the repo root (already git-ignored):
     `CLIENT_SECRET=<paste>` then it will be picked up by `source .env`.
  Devnet reachability from the container is **confirmed** (`auth` → 405 on GET,
  `ledger-api` → 401 — both mean "reachable, needs a POST/token"). So the secret is the
  only missing piece for the live run.

- [!] **Configure a git remote.** This clone has **no `origin`** (`git remote -v` is empty),
  so the branch `daml-interaction` cannot be pushed and no PR can be opened from here. Add
  the GitHub remote (`git remote add origin <url>`) or push from a checkout that has one.
  All work is committed locally on `daml-interaction` and is ready to push once a remote exists.

## Decisions

- [x] `CLIENT_SECRET` will be provided (per plan, 2026-07-10). ⚠️ Not yet present in this
  container — see the blocking item above.
- [ ] OK to allocate `netchain-operator` + `netchain-company-a/b/c` on the shared M2M
  participant (user 6)? `deploy.sh` is idempotent and will reuse existing party ids if the
  hints already resolve.
- [ ] Allocated party ids: `deploy.sh` writes them into untracked `.env` and (optionally)
  `.env.example`. They are public devnet identifiers of the same class as the already-committed
  `PRIMARY_PARTY`, so committing them to `.env.example` is safe — leave the placeholder lines
  in `.env.example` if you'd rather keep them local.
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
