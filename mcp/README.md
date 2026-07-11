# @netchain/mcp

MCP server for NetChain, so any MCP-capable AI agent (Claude, or otherwise) can drive
the whole product over the network, no UI required.

## What is NetChain

NetChain is a corporate netting ledger built on Daml/Canton. Companies record obligations
(invoices) they owe each other, an operator periodically nets all open obligations into a
single settlement per cycle, and settlement is capped per party by an on-ledger
`TreasuryPolicy` that no participant, human or AI, can exceed. The point of this MCP server
is to hand that whole flow to an agent while keeping the ledger's guarantees intact: the
agent can propose obligations, cycles, and settlements, but the ledger itself is what
decides whether a settlement is allowed.

This server is a thin wrapper: every tool below is exactly one `fetch` call against the
already-deployed HTTP API (`${NETCHAIN_API_BASE}/api/ledger/<op>`, default
`https://netchain.vercel.app`). No business logic, caching, or state lives here.

## Tools

| Tool | Wraps | Purpose |
|---|---|---|
| `list_obligations` | `GET obligations?party=` | List a party's obligations (owed / owing) |
| `get_balances` | `GET balance?party=` / `GET balances` | One party's balance, or all three |
| `get_net_positions` | `GET net-position?party=` / `GET net-positions` | One party's net position, or all |
| `get_policy` | `GET policy?party=` | A party's `TreasuryPolicy`, incl. `maxSettlementPerCycle` |
| `create_obligation` | `POST obligation` | Record a new obligation (invoice) |
| `check_policy` | `POST policy-check` | Dry-run whether an amount would pass a party's cap |
| `run_netting_cycle` | `POST run-cycle` | Open a cycle and compute net positions |
| `settle` | `POST settle` | Execute settlement for the current cycle (see below) |
| `get_activity` | `GET activity` | Full chronological activity feed / audit trail |
| `query_contract` | `GET contract?party=&contractId=` | Fetch a contract as a party would see it (privacy check) |

### The property that matters: `settle` is bounded by the ledger, not by the agent

`settle` is gated **on-ledger** by each involved party's `TreasuryPolicy.maxSettlementPerCycle`.
If a settlement would move more than a party's cap in one cycle, the Daml contract itself
rejects the whole settlement, there is no client-side or server-side check to talk around.
An agent can propose any settlement it likes; the ledger disposes. This is the same
guarantee whether the caller is a human, a script, or an autonomous agent looping on this
MCP server.

## Connecting

Build once:

```bash
cd mcp
npm install
npm run build
```

Then add it to your MCP client config, e.g. this repo's `.mcp.json` at the project root
(or your global Claude config):

```json
{
  "mcpServers": {
    "netchain": {
      "command": "node",
      "args": ["mcp/dist/index.js"],
      "env": { "NETCHAIN_API_BASE": "https://netchain.vercel.app" }
    }
  }
}
```

`NETCHAIN_API_BASE` is optional, it defaults to `https://netchain.vercel.app`. Point it at
`http://localhost:3000` to drive a local dev server instead.

## Sample agent flow

A typical session an agent would run against this server:

1. **Record an invoice as an obligation**
   `create_obligation({ obligor: "company-a", obligee: "company-b", amount: 20000, reference: "INV-2044", dueDate: "2026-08-01" })`
2. **Run a netting cycle** to fold all open obligations into net positions
   `run_netting_cycle({})` → inspect with `get_net_positions({})`
3. **Try to settle over cap and get blocked.** Suppose `company-a`'s policy caps
   settlement at 15,000 but the netted amount it must pay is 20,000:
   `check_policy({ party: "company-a", amount: 20000 })` → `{ ok: false, ruleFired: "..." }`,
   and if attempted anyway, `settle({})` fails because the ledger's `TreasuryPolicy` check
   inside the `Settle` choice rejects it, the settlement does not happen.
4. **Settle under cap.** Once the obligation/cycle nets to an amount within every party's
   cap (e.g. record a smaller obligation, or split it across cycles), `run_netting_cycle({})`
   then `settle({})` succeeds and returns `{ updateId, netPositions }`.
5. **Audit it.** `get_activity({})` shows the obligation, cycle, and settlement events in
   order; `query_contract({ party: "company-c", contractId: <company-a/b's obligation> })`
   returns 404 `CONTRACT_NOT_FOUND`, demonstrating that `company-c` was never a stakeholder
   and genuinely cannot see it.

## Development

- `npm run build`, compile `src/` to `dist/` with `tsc`.
- `npm start`, run the compiled server directly (stdio transport).
- No test harness here by design (ponytail): the server has no logic of its own to unit
  test, it is a pass-through to the real API's tested behavior.
