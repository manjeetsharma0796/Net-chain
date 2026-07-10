# NetChain — working agreement

## Ponytail is always on (not optional)

Before writing or changing **any** code in this repo, apply the **ponytail** YAGNI ladder
(`.claude/skills/ponytail/SKILL.md`), default level **full**. Read the task and the code it
touches first, then climb the ladder and stop at the first rung that holds — ship the shortest
diff that actually works. This applies to every task and every contributor.

Where it fits in the pipeline:
- **Authoring** — every code change runs through the ladder (reuse before rewrite, stdlib/native
  before a dependency, one line before fifty). A `UserPromptSubmit` hook re-states this each turn.
- **Review** — run `/ponytail-review` on the diff before opening/merging a PR. Other lenses:
  `/ponytail-audit`, `/ponytail-debt`, `/ponytail-gain`, `/ponytail-help`.
- **CI** — ponytail is an agent skill, not a linter, so it does **not** run in CI. CI
  (`.github/workflows/daml.yml`) only builds + tests the Daml package.

Levels: `/ponytail lite|full|ultra`. Turn off only if explicitly asked: "stop ponytail".

## Project pointers

- Task pool + status: `TASKS.md`. Human-only actions/decisions: `OPERATOR_TODO.md`.
- Ledger integration: mock (`lib/api.ts`) ⇄ live (`lib/ledger.ts` → `app/api/ledger/*` →
  `lib/ledger-server.ts`). Toggle with `NEXT_PUBLIC_LEDGER_LIVE` in an untracked `.env`
  (never commit secrets). Deploy on-ledger state: `cd daml && source ../.env && ./deploy.sh`.
