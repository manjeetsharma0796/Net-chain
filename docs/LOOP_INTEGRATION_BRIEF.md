# Loop wallet integration, brief + operator questions (for veribee edu)

Owner to consult: **veribee edu** (Loop wallet expert). This is a working brief for a parallel
Claude session to pick up. Goal: figure out whether Loop can be integrated into NetChain in a way
that is meaningful and honest, and what to ask Five North.

## Why this matters

NetChain today is single-tenant: one shared M2M token acts as all parties, and new real parties
cannot be provisioned on the shared devnet (the M2M user is at its 1000 user-rights cap). Letting a
user **bring their own Canton party via a wallet** would sidestep provisioning entirely and turn
NetChain into a real multi-tenant product. Loop is the obvious candidate wallet.

## What the research already found (2026-07-12)

- **Loop is a real non-custodial Canton wallet** with a public dApp SDK, `@fivenorth/loop-sdk`
  (`github.com/fivenorth-io/loop-sdk`, v0.13.1).
- `loop.connect()` opens a QR/popup and returns the connected user's real **`party_id`**. It also
  supports message signing and `submitTransaction()` with per-transaction user approval.
- **The hard blocker:** the SDK README states it only submits transactions against **Splice + Five
  North's own "Utility app" DAR files**, with "no plan" to support third-party DARs. So Loop **cannot
  submit commands against NetChain's own Daml templates** today. Connect + read `party_id` +
  message-sign likely work generically; on-ledger action on NetChain's contracts does not.
- The correct long-term standard is **CIP-0103** (approved Jan 2026, an EIP-1193 analog) plus Canton
  external-party / interactive-submission signing, via `splice-wallet-kernel`. That is a multi-week
  integration, not a hackathon patch.

## The meaningful, achievable near-term angle (candidate)

Even without NetChain-tx submission, a **"Connect Loop wallet" flow is buildable with the public SDK**
and would be a genuine integration touchpoint:

1. A "Connect Loop" button calls `loop.connect()` and displays **"Connected as `<real party_id>` via
   Loop"**, proving the user holds a real on-ledger Canton identity (not a demo persona).
2. Optionally `signMessage` to prove the user controls that party.
3. NetChain actions can still route through the operator for now, but the identity is real and shown.

This is honest ("your real Canton wallet is connected; on-ledger actions currently settle through the
NetChain operator; per-user signing is on the roadmap") and gives a strong "real Canton" demo moment.
It does not overclaim that Loop is driving NetChain's contracts.

## Operator questions for veribee (please confirm / answer)

1. Does the current `loop-sdk` truly block ALL third-party DAR submission, or is there an
   allowlist / beta / request path? Is "no plan" firm, or negotiable with Five North?
2. Can Loop `connect()` + return `party_id` + `signMessage` work against our 5N **devnet** for a
   third-party web app, WITHOUT submitting a NetChain transaction (i.e. the cosmetic "connect real
   identity" flow above)? Any gotchas (network selection, passkey, CORS, origin allowlisting)?
3. Could a Loop-connected user's party be granted **`CanReadAs`** on NetChain's operator so the
   connected user sees their REAL per-party projection (read-only) in NetChain, even if they cannot
   sign NetChain txs? Does that hit the same rights cap, and what is the flow?
4. For real per-user **signing** of NetChain txs: is Canton's external-party / interactive-submission
   (`/v2/interactive-submission/prepare` then sign then execute) the path, and does Loop expose a
   signing hook for an ARBITRARY prepared transaction (not just Splice/Utility)?
5. Realistic effort + prerequisites for a **CIP-0103 / splice-wallet-kernel** integration against
   NetChain's own DAR? Is anyone on 5N devnet doing this yet?
6. Is the near-term "connect + show real party_id" angle worth shipping for the hackathon, in your
   view, or does it read as thin without real per-user actions?

## Decision framework

- If Q2/Q3 confirm **connect + read party_id (+ optional read-only projection)** works: ship a minimal
  "Connect Loop" flow (real, low effort) as the honest first step, roadmap the rest.
- If real per-user NetChain **actions** are required and Q1/Q4 stay blocked: it needs Five North to
  open third-party DARs, or a multi-week CIP-0103 build. Document as roadmap, do not fake it.

## How to collaborate

veribee's Claude session can start from this file: answer the questions inline, and if the connect
angle is viable, prototype a `components/` "Connect Loop" button against `@fivenorth/loop-sdk` behind a
feature flag (do not touch the live settle path). Keep it honest about what is real vs roadmap. See
`OPERATOR_TODO.md` (Real-user onboarding paths) for the provisioning-cap context.
