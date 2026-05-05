import { describe, it, expect } from 'vitest';
import { computeVettingResult } from '../collector/vetting.js';
import type { VettingInput } from '../collector/vetting.js';
import type { OutletRecord } from '../collector/types.js';

const KNOWN_OUTLET: OutletRecord = {
  id: 'outlet-1',
  canonicalName: 'Reuters',
  aliases: JSON.stringify(['reuters.com']),
  biasAnchor: 0.0,
  reliabilityBase: 0.9,
  region: null,
};

function makeGeminiResult(overrides: Partial<VettingInput['geminiResult']> = {}): VettingInput['geminiResult'] {
  return {
    summary: 'Test summary.',
    actionableIntel: 'Watch this space.',
    biasScore: 0.1,
    sectorTags: ['policy'],
    outletName: 'Reuters',
    estimatedPublishDate: '2026-04-22',
    ...overrides,
  };
}

function makeInput(overrides: Partial<VettingInput> = {}): VettingInput {
  return {
    geminiResult: makeGeminiResult(),
    outlet: KNOWN_OUTLET,
    outletBiasAnchor: 0.0,
    isCorroborated: false,
    ...overrides,
  };
}

describe('computeVettingResult()', () => {
  describe('trustScore', () => {
    it('uses outlet reliabilityBase when outlet is known', () => {
      const result = computeVettingResult(makeInput({ outlet: KNOWN_OUTLET }));
      // blendedBias = (0.1 + 0.0) / 2 = 0.05; trustScore = computeTrustRating(0.05, 0, 0.9)
      expect(result.trustScore).toBeGreaterThan(0.6);
    });

    it('uses provisional reliability of 0.5 when outlet is unknown', () => {
      const result = computeVettingResult(makeInput({ outlet: null }));
      expect(result.outletKnown).toBe(false);
      // reliabilityBase=0.5, blendedBias≈0.05, no corroboration → trust ≈ 0.285
      expect(result.trustScore).toBeGreaterThan(0.2);
      expect(result.trustScore).toBeLessThan(0.5);
    });
  });

  describe('flag derivation (priority order)', () => {
    it('flags UNKNOWN_OUTLET first, even over LOW_TRUST', () => {
      // biasScore=1.0 with unknown outlet → trust would be very low, but UNKNOWN_OUTLET wins
      const result = computeVettingResult(makeInput({
        outlet: null,
        geminiResult: makeGeminiResult({ biasScore: 1.0 }),
      }));
      expect(result.flag).toBe('UNKNOWN_OUTLET');
    });

    it('flags LOW_TRUST when trust < 0.25 and outlet is known', () => {
      const lowReliabilityOutlet: OutletRecord = { ...KNOWN_OUTLET, reliabilityBase: 0.1 };
      const result = computeVettingResult(makeInput({
        outlet: lowReliabilityOutlet,
        outletBiasAnchor: 0.0,
        geminiResult: makeGeminiResult({ biasScore: 0.9 }), // high bias to drive trust down
      }));
      expect(result.flag).toBe('LOW_TRUST');
    });

    it('flags BIAS when |biasScore| > 0.5 and trust is acceptable', () => {
      const result = computeVettingResult(makeInput({
        outlet: KNOWN_OUTLET,
        outletBiasAnchor: 0.6,
        geminiResult: makeGeminiResult({ biasScore: 0.6 }),
      }));
      expect(result.flag).toBe('BIAS');
    });

    it('flags UNVERIFIED when single-source with no severe issues', () => {
      const result = computeVettingResult(makeInput({ isCorroborated: false }));
      expect(result.flag).toBe('UNVERIFIED');
    });

    it('returns null flag when all conditions pass', () => {
      const result = computeVettingResult(makeInput({ isCorroborated: true }));
      expect(result.flag).toBeNull();
    });
  });

  describe('autoApprove', () => {
    it('is false when not corroborated', () => {
      const result = computeVettingResult(makeInput({ isCorroborated: false }));
      expect(result.autoApprove).toBe(false);
    });

    it('is false when outlet unknown', () => {
      const result = computeVettingResult(makeInput({ outlet: null, isCorroborated: true }));
      expect(result.autoApprove).toBe(false);
    });

    it('is false when |biasScore| >= 0.5', () => {
      const result = computeVettingResult(makeInput({
        isCorroborated: true,
        outletBiasAnchor: 0.5,
        geminiResult: makeGeminiResult({ biasScore: 0.5 }),
      }));
      expect(result.autoApprove).toBe(false);
    });

    it('is true when trust high, bias low, corroborated, outlet known', () => {
      const result = computeVettingResult(makeInput({
        outlet: KNOWN_OUTLET,
        outletBiasAnchor: 0.0,
        isCorroborated: true,
        geminiResult: makeGeminiResult({ biasScore: 0.0 }),
      }));
      expect(result.autoApprove).toBe(true);
      expect(result.flag).toBeNull();
    });
  });

  describe('output fields', () => {
    it('blends bias: (geminiScore + outletAnchor) / 2', () => {
      const result = computeVettingResult(makeInput({
        geminiResult: makeGeminiResult({ biasScore: 0.4 }),
        outletBiasAnchor: 0.2,
      }));
      expect(result.biasScore).toBeCloseTo(0.3);
    });

    it('passes through Gemini summary and actionableIntel unchanged', () => {
      const result = computeVettingResult(makeInput());
      expect(result.summary).toBe('Test summary.');
      expect(result.actionableIntel).toBe('Watch this space.');
    });

    it('sets outletKnown correctly', () => {
      expect(computeVettingResult(makeInput({ outlet: KNOWN_OUTLET })).outletKnown).toBe(true);
      expect(computeVettingResult(makeInput({ outlet: null })).outletKnown).toBe(false);
    });

    it('clamps blended bias to [-1, 1]', () => {
      const result = computeVettingResult(makeInput({
        geminiResult: makeGeminiResult({ biasScore: 1.0 }),
        outletBiasAnchor: 1.0,
      }));
      expect(result.biasScore).toBeLessThanOrEqual(1.0);
      expect(result.biasScore).toBeGreaterThanOrEqual(-1.0);
    });

    it('does not include outletReliabilityEstimate in output (removed in Phase 2b)', () => {
      const result = computeVettingResult(makeInput());
      expect(result).not.toHaveProperty('outletReliabilityEstimate');
      expect(result).not.toHaveProperty('outletReliabilityReasoning');
    });
  });
});
