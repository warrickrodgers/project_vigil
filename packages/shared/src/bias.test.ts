import { describe, it, expect } from 'vitest';
import { computeTrustRating } from './bias.js';

// New formula: clamp(outletReliability - |biasScore|*0.3 - (corroborating===0 ? 0.2 : 0), 0, 1)

describe('computeTrustRating', () => {
  it('returns 1.0 for a perfectly reliable, centrist, corroborated article', () => {
    expect(computeTrustRating(0, 1, 1.0)).toBe(1.0);
  });

  it('clamps to 0.0 at the lower bound', () => {
    // outletReliability=0, any bias or single-source pushes below 0
    expect(computeTrustRating(0, 0, 0.0)).toBe(0.0); // 0.0 - 0 - 0.2 = -0.2 → 0
    expect(computeTrustRating(1.0, 0, 0.0)).toBe(0.0); // 0.0 - 0.3 - 0.2 = -0.5 → 0
    expect(computeTrustRating(10, 0, 1.0)).toBe(0.0); // 1.0 - 3.0 - 0.2 = -2.2 → 0
  });

  it('penalises single-source articles (0 corroborations) by 0.2', () => {
    const withCorroboration = computeTrustRating(0, 3, 1.0); // 1.0
    const singleSource = computeTrustRating(0, 0, 1.0);      // 0.8
    expect(singleSource).toBeLessThan(withCorroboration);
    expect(singleSource).toBeCloseTo(0.8, 5);
  });

  it('penalises high bias magnitude', () => {
    const center = computeTrustRating(0, 1, 1.0);
    const biased = computeTrustRating(0.9, 1, 1.0);
    expect(biased).toBeLessThan(center);
    expect(biased).toBeCloseTo(1.0 - 0.9 * 0.3, 5); // 0.73
  });

  it('treats left and right bias symmetrically', () => {
    expect(computeTrustRating(-0.5, 2, 0.9)).toBeCloseTo(
      computeTrustRating(0.5, 2, 0.9),
      10,
    );
  });

  it('never exceeds 1.0 (even with negative bias scores)', () => {
    expect(computeTrustRating(-5, 100, 1.0)).toBeLessThanOrEqual(1.0);
  });

  it('high-reliability outlet with extreme bias still beats a low-reliability centrist', () => {
    // Trusted outlet (0.95) with strong-but-not-extreme bias (0.7), corroborated:
    //   0.95 - 0.21 - 0 = 0.74
    const highReliabilityBiased = computeTrustRating(0.7, 1, 0.95);
    // Low-reliability outlet (0.5), perfectly centrist, corroborated:
    //   0.5 - 0 - 0 = 0.5
    const lowReliabilityCentrist = computeTrustRating(0.0, 1, 0.5);
    expect(highReliabilityBiased).toBeGreaterThan(lowReliabilityCentrist);
    expect(highReliabilityBiased).toBeCloseTo(0.74, 5);
    expect(lowReliabilityCentrist).toBeCloseTo(0.5, 5);
  });
});
