#!/usr/bin/env node
/**
 * NetChain MCP server.
 *
 * A thin wrapper over NetChain's already-deployed HTTP API
 * (`${NETCHAIN_API_BASE}/api/ledger/<op>`). Every tool below is one fetch
 * call, no business logic duplicated here.
 *
 * NetChain is a corporate netting ledger built on Daml/Canton: companies
 * record obligations (invoices), an operator nets them into a single
 * settlement per cycle, and each party's TreasuryPolicy contract caps how
 * much can leave its account in one cycle. The killer property this server
 * exposes to agents: `settle` is gated ON-LEDGER by that cap. An agent can
 * propose a settlement, but it cannot make the ledger exceed the cap, an
 * over-cap settlement is rejected by the ledger itself, not by this server
 * or by client-side logic. AI proposes, the ledger disposes.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE = (process.env.NETCHAIN_API_BASE ?? "https://netchain.vercel.app").replace(/\/$/, "");

const PartyId = z.enum(["company-a", "company-b", "company-c"]);

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

function ok(body: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(body, null, 2) }] };
}

function err(status: number, body: unknown): ToolResult {
  return {
    content: [
      { type: "text", text: `Ledger API returned HTTP ${status}: ${JSON.stringify(body)}` },
    ],
    isError: true,
  };
}

async function apiGet(op: string, params: Record<string, string> = {}): Promise<ToolResult> {
  const url = new URL(`${BASE}/api/ledger/${op}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  const body = await res.json().catch(() => null);
  return res.ok ? ok(body) : err(res.status, body);
}

async function apiPost(op: string, body: unknown): Promise<ToolResult> {
  const res = await fetch(`${BASE}/api/ledger/${op}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return res.ok ? ok(data) : err(res.status, data);
}

const server = new McpServer({
  name: "netchain",
  version: "0.1.0",
  title: "NetChain",
  description:
    "Drives the NetChain corporate netting ledger (Daml/Canton). Record obligations, " +
    "net them into a cycle, and settle, all over HTTP against the live deployed ledger. " +
    "Bounded-authority guarantee: `settle` is capped by each party's on-ledger " +
    "TreasuryPolicy, the ledger itself rejects any settlement over the cap, no agent " +
    "or client can override it. AI proposes, the ledger disposes.",
});

server.registerTool(
  "list_obligations",
  {
    title: "List obligations",
    description:
      "List every obligation (invoice) where `party` is the obligor or obligee. Use this " +
      "to see what a party currently owes or is owed before deciding to record a new " +
      "obligation or run a netting cycle.",
    inputSchema: { party: PartyId },
  },
  async ({ party }) => apiGet("obligations", { party }),
);

server.registerTool(
  "get_balances",
  {
    title: "Get account balance(s)",
    description:
      "Get the USDCx account balance for one `party`, or omit `party` to get all three " +
      "companies' balances at once. Use this to check funds before or after a settlement.",
    inputSchema: { party: PartyId.optional() },
  },
  async ({ party }) => (party ? apiGet("balance", { party }) : apiGet("balances")),
);

server.registerTool(
  "get_net_positions",
  {
    title: "Get net position(s)",
    description:
      "Get the net position (what a party owes vs. is owed, netted to one number) for one " +
      "`party` from the most recent cycle, or omit `party` to get every party's net " +
      "position at once. Positive = net receiver, negative = net payer. Run this after " +
      "`run_netting_cycle` to see the result before calling `settle`.",
    inputSchema: { party: PartyId.optional() },
  },
  async ({ party }) => (party ? apiGet("net-position", { party }) : apiGet("net-positions")),
);

server.registerTool(
  "get_policy",
  {
    title: "Get treasury policy",
    description:
      "Get `party`'s on-ledger TreasuryPolicy, in particular `maxSettlementPerCycle`, the " +
      "hard cap the ledger enforces on `settle`. Use this to predict whether a settlement " +
      "will be accepted before attempting it.",
    inputSchema: { party: PartyId },
  },
  async ({ party }) => apiGet("policy", { party }),
);

server.registerTool(
  "create_obligation",
  {
    title: "Create obligation (record an invoice)",
    description:
      "Record a new obligation on the ledger: `obligor` owes `obligee` `amount` USDCx by " +
      "`dueDate`, tagged with `reference` (e.g. an invoice number). Use this to enter a new " +
      "invoice or payable before it is picked up by a netting cycle. `source` stamps " +
      "provenance on-ledger and defaults to `agent`, since a tool call from an AI agent is " +
      "exactly what that label is for.",
    inputSchema: {
      obligor: PartyId,
      obligee: PartyId,
      amount: z.number().positive(),
      reference: z.string().min(1),
      dueDate: z.string().describe("ISO date, e.g. 2026-08-01"),
      source: z.enum(["agent", "manual"]).default("agent"),
    },
  },
  async (input) => apiPost("obligation", input),
);

server.registerTool(
  "check_policy",
  {
    title: "Check policy (dry-run a settlement amount)",
    description:
      "Ask the ledger whether settling `amount` for `party` would pass its TreasuryPolicy " +
      "cap, without actually settling anything. Returns `{ ok, ruleFired? }`. Use this to " +
      "sanity-check a figure before proposing `settle`, the ledger's real enforcement still " +
      "happens inside `settle` itself.",
    inputSchema: { party: PartyId, amount: z.number().positive() },
  },
  async (input) => apiPost("policy-check", input),
);

server.registerTool(
  "run_netting_cycle",
  {
    title: "Run netting cycle",
    description:
      "Open a new cycle and compute net positions from all open obligations. Call this " +
      "before `settle`, then inspect the result with `get_net_positions`.",
    inputSchema: {},
  },
  async () => apiPost("run-cycle", {}),
);

server.registerTool(
  "settle",
  {
    title: "Settle the current cycle",
    description:
      "Execute the settlement for the most recently computed cycle, transferring funds " +
      "per each party's net position. THE KEY GUARANTEE: this call is gated on-ledger by " +
      "every involved party's TreasuryPolicy `maxSettlementPerCycle` cap. If any party's " +
      "cut of the settlement would exceed its cap, the ledger itself rejects the whole " +
      "settlement, an agent cannot talk, retry, or reason its way past this, it is enforced " +
      "by the Daml contract, not by this server or by client-side checks. Call " +
      "`run_netting_cycle` first, and optionally `check_policy` or `get_policy` to predict " +
      "the outcome.",
    inputSchema: {},
  },
  async () => apiPost("settle", {}),
);

server.registerTool(
  "get_activity",
  {
    title: "Get activity feed",
    description:
      "Get the full chronological activity feed (obligations, cycles, settlements, policy " +
      "events, network events) across the whole ledger. Use this for an audit trail or to " +
      "explain what has happened so far.",
    inputSchema: {},
  },
  async () => apiGet("activity"),
);

server.registerTool(
  "query_contract",
  {
    title: "Query a contract as a party (privacy check)",
    description:
      "Fetch `contractId` as `party` would see it. If `party` is not a stakeholder on that " +
      "contract, the ledger returns 404 CONTRACT_NOT_FOUND, it is not merely filtered client" +
      "-side, the party's ledger view genuinely does not contain it. Use this to demonstrate " +
      "or verify sub-transaction privacy: the same contractId is visible to its stakeholders " +
      "and invisible to everyone else.",
    inputSchema: { party: PartyId, contractId: z.string().min(1) },
  },
  async ({ party, contractId }) => apiGet("contract", { party, contractId }),
);

server.registerTool(
  "verify_transaction",
  {
    title: "Verify transaction (prove it's real, not a mock)",
    description:
      "Re-fetch a `settle`/transaction `updateId` from the real Canton validator to PROVE " +
      "it is a genuine on-ledger transaction, not a mock. Canton keeps transaction CONTENT " +
      "private to its parties, so this only confirms existence and timing on the validator, " +
      "fetched live, without exposing that content. Use this to show a user that an action " +
      "you took (e.g. a `settle` call) really happened on-chain.",
    inputSchema: { updateId: z.string().min(1) },
  },
  async ({ updateId }) => apiGet("verify", { updateId }),
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e) => {
  console.error("netchain-mcp fatal error:", e);
  process.exit(1);
});
