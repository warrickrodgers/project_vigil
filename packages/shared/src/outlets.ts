// ---------------------------------------------------------------------------
// Outlet resolution helpers
// ---------------------------------------------------------------------------

/**
 * Minimal shape required for outlet resolution.
 * The full Prisma `Outlet` model satisfies this interface.
 */
export interface OutletLike {
  canonicalName: string;
  /** JSON-encoded string[] of alternate names (e.g. ["AP", "Associated Press"]) */
  aliases: string;
}

/**
 * Normalise an outlet name for case-insensitive, whitespace-collapsed comparison.
 */
export function normalizeOutletName(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Resolve a raw outlet name string to a known Outlet record.
 *
 * Resolution order:
 *  1. Exact match against `canonicalName` (case-insensitive, trimmed)
 *  2. Walk each outlet's `aliases` array (case-insensitive, trimmed)
 *
 * Returns `null` when no match is found — the caller decides whether to
 * create a new outlet, reject the article, or log-and-skip.
 */
export function resolveOutlet<T extends OutletLike>(rawName: string, outlets: T[]): T | null {
  const needle = normalizeOutletName(rawName);

  for (const outlet of outlets) {
    if (normalizeOutletName(outlet.canonicalName) === needle) {
      return outlet;
    }
  }

  for (const outlet of outlets) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(outlet.aliases);
    } catch {
      continue;
    }
    if (!Array.isArray(parsed)) continue;

    for (const alias of parsed) {
      if (typeof alias === 'string' && normalizeOutletName(alias) === needle) {
        return outlet;
      }
    }
  }

  return null;
}
