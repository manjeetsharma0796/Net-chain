# NetChain, working agreement

## Ponytail is always on (not optional)

Before writing or changing **any** code in this repo, apply the **ponytail** YAGNI ladder
(`.claude/skills/ponytail/SKILL.md`), default level **full**. Read the task and the code it
touches first, then climb the ladder and stop at the first rung that holds, ship the shortest
diff that actually works. This applies to every task and every contributor.

Where it fits in the pipeline:
- **Authoring**, every code change runs through the ladder (reuse before rewrite, stdlib/native
  before a dependency, one line before fifty). A `UserPromptSubmit` hook re-states this each turn.
- **Review**, run `/ponytail-review` on the diff before opening/merging a PR. Other lenses:
  `/ponytail-audit`, `/ponytail-debt`, `/ponytail-gain`, `/ponytail-help`.
- **CI**, ponytail is an agent skill, not a linter, so it does **not** run in CI. CI
  (`.github/workflows/daml.yml`) only builds + tests the Daml package.

Levels: `/ponytail lite|full|ultra`. Turn off only if explicitly asked: "stop ponytail".

## Frontend pipeline (every frontend edit goes through this)

Any change under `app/`, `components/`, or app styling MUST run this pipeline. This is not
optional, it applies to every UI task and every contributor.

1. **Design intelligence first.** Consult the **ui-ux-pro-max** skill (`.claude/skills/ui-ux-pro-max`)
   for styles, palettes, typography, and UX guidance before writing or restyling UI. Related skills:
   `ui-styling`, `design`, `design-system`, `brand`.
2. **Components via 21st.dev.** Use the **`magic`** MCP server (21st.dev Magic, configured in
   `.mcp.json`) when building or refining a component. Needs `TWENTYFIRST_API_KEY` in your env.
3. **Verify live with Playwright, no mocks.** A frontend change is not done until Playwright (the
   `playwright` MCP or `@playwright/test`) drives the running app in a real browser, asserts the real
   behavior, and captures a screenshot. Verify against the live ledger data path, not the mock.

When wiring real data, keep the visuals identical (see `docs/UPGRADE_PLAN.md`). Ponytail still applies:
the pipeline is about correctness and design quality, not adding scope. New MCP servers connect only
after Claude Code restarts.

## Debugging & wiring pipeline (for correctness/wiring bugs)

1. **Map the wiring first with graphify** (see the graphify section below): `graphify query`/`path`/`explain`
   to trace how a page's data actually flows (component -> `lib/ledger.ts` -> `/api/ledger/*` ->
   `lib/ledger-server.ts` -> Daml), instead of guessing from grep. Rebuild with `graphify update .` after edits.
2. **Inspect the real running UI** with the `chrome-devtools` MCP (network requests, console errors,
   source-mapped stack traces, DOM) to see what the app actually fetches vs. what it renders, and to
   catch silent mock fallbacks. The `playwright` MCP covers console/network too when chrome-devtools
   is not yet connected (it needs a restart).
3. **Debug in a cycle:** reproduce live -> map wiring -> find the mock/real gap -> fix the shortest diff
   -> re-verify live. A "wiring" bug is usually a page reading client/store/mock state instead of the
   live on-ledger path.

## Project pointers

- Task pool + status: `TASKS.md`. Human-only actions/decisions: `OPERATOR_TODO.md`.
- Ledger integration: mock (`lib/api.ts`) ⇄ live (`lib/ledger.ts` → `app/api/ledger/*` →
  `lib/ledger-server.ts`). Toggle with `NEXT_PUBLIC_LEDGER_LIVE` in an untracked `.env`
  (never commit secrets). Deploy on-ledger state: `cd daml && source ../.env && ./deploy.sh`.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
