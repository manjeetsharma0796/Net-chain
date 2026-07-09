/** Formatting helpers — every figure in the UI goes through these. */

export function formatUSDCx(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount) < 0.005 ? 0 : amount);
}

export function formatCompact(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Truncate a ledger hash for display: 1220ab…9f3c */
export function shortHash(hash: string, head = 6, tail = 4): string {
  if (hash.length <= head + tail + 1) return hash;
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

/**
 * Deterministic pseudo-hash for mock contract ids / tx hashes.
 * Not cryptographic — just stable, hex-looking output for the demo.
 */
export function mockHash(seed: string, length = 40): string {
  let h = 0x811c9dc5;
  const out: string[] = [];
  for (let i = 0; out.join("").length < length; i++) {
    const c = seed.charCodeAt(i % seed.length) + i;
    h = Math.imul(h ^ c, 0x01000193) >>> 0;
    out.push(h.toString(16));
  }
  return out.join("").slice(0, length);
}
