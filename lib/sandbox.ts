/**
 * Runtime sandbox switch. When active, the live ledger wrappers in lib/ledger.ts
 * skip the real validator and fall back to the in-session mock engine, so a
 * self-serve "try it yourself" tenant runs entirely client-side and never touches
 * the shared devnet ledger. Set by the store's initSandbox / exitSandbox.
 *
 * A plain module singleton (not React state) so lib/ledger.ts, which is not a
 * component, can read it synchronously without a circular store import.
 */

let active = false;

export function setSandbox(on: boolean): void {
  active = on;
}

export function isSandbox(): boolean {
  return active;
}
