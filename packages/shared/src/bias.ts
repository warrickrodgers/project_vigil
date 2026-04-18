// ---------------------------------------------------------------------------
// Trust rating
// ---------------------------------------------------------------------------

/**
 * Compute a per-article trust rating.
 *
 * Formula (naive, Phase 0/1):
 *   clamp(outletReliability - |biasScore| * 0.3 - (corroboratingSourceCount === 0 ? 0.2 : 0), 0, 1)
 *
 * - outletReliability comes from Outlet.reliabilityBase (seeded per-outlet).
 * - biasScore is -1.0 (hard left) to 1.0 (hard right).
 * - Single-source penalty (-0.2) discounts stories not picked up by any other outlet.
 *
 * Will be replaced by embedding-similarity weighting in Phase 2.
 *
 * @param biasScore                -1.0 to 1.0
 * @param corroboratingSourceCount Number of other outlets covering the same story
 * @param outletReliability        Outlet.reliabilityBase, 0.0–1.0
 */
export function computeTrustRating(
  biasScore: number,
  corroboratingSourceCount: number,
  outletReliability: number,
): number {
  const raw =
    outletReliability -
    Math.abs(biasScore) * 0.3 -
    (corroboratingSourceCount === 0 ? 0.2 : 0);
  return Math.min(1, Math.max(0, raw));
}
