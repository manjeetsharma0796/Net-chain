/** Formatting helpers, every figure in the UI goes through these. */

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

// Pin the timezone (UTC) so server and client render identical text: without it
// toLocale*String uses the runtime zone, so SSR (UTC) and the browser (local)
// disagree and React reports a hydration mismatch. Ledger timestamps are UTC.
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

/** Truncate a ledger hash for display: 1220ab…9f3c */
export function shortHash(hash: string, head = 6, tail = 4): string {
  if (hash.length <= head + tail + 1) return hash;
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

/**
 * Deterministic pseudo-hash for mock contract ids / tx hashes.
 * Not cryptographic, just stable, hex-looking output for the demo.
 */
export function mockHash(seed: string, length = 40): string {
  let h = 0x811c9dc5;
  // Fold the WHOLE seed first, so every emitted digit depends on all of it.
  // Otherwise seeds differing only in a late char (e.g. "ob-001" vs "ob-006")
  // collide: the differing char isn't consumed before `length` is reached and
  // its influence lands past the slice, yielding identical hashes.
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ (seed.charCodeAt(i) + i), 0x01000193) >>> 0;
  }
  const out: string[] = [];
  for (let i = 0; out.join("").length < length; i++) {
    h = Math.imul(h ^ (seed.charCodeAt(i % seed.length) + i), 0x01000193) >>> 0;
    out.push(h.toString(16));
  }
  return out.join("").slice(0, length);
}
