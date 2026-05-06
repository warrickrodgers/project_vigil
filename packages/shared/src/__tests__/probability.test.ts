import { describe, it, expect } from 'vitest';
import {
  IC_PROBABILITY_TABLE,
  probabilityToTerm,
  deriveConfidence,
  formatConfidenceExplanation,
  formatProbabilityTableForPrompt,
  formatConfidenceFrameworkForPrompt,
} from '../probability.js';

describe('IC_PROBABILITY_TABLE', () => {
  it('has 7 entries', () => {
    expect(IC_PROBABILITY_TABLE).toHaveLength(7);
  });

  it('covers 1-99 without gaps', () => {
    const sorted = [...IC_PROBABILITY_TABLE].sort((a, b) => a.rangeMin - b.rangeMin);
    expect(sorted[0]!.rangeMin).toBe(1);
    expect(sorted[sorted.length - 1]!.rangeMax).toBe(99);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i]!.rangeMin).toBeLessThanOrEqual(sorted[i - 1]!.rangeMax + 1);
    }
  });

  it('each entry has primary, alternate, range, and usage', () => {
    for (const entry of IC_PROBABILITY_TABLE) {
      expect(entry.primary).toBeTruthy();
      expect(entry.alternate).toBeTruthy();
      expect(typeof entry.rangeMin).toBe('number');
      expect(typeof entry.rangeMax).toBe('number');
      expect(entry.usage).toBeTruthy();
    }
  });
});

describe('probabilityToTerm', () => {
  it('returns "Almost no chance" for probability 3', () => {
    expect(probabilityToTerm(3).primary).toBe('Almost no chance');
  });

  it('returns "Very unlikely" for probability 10', () => {
    expect(probabilityToTerm(10).primary).toBe('Very unlikely');
  });

  it('returns "Unlikely" for probability 30', () => {
    expect(probabilityToTerm(30).primary).toBe('Unlikely');
  });

  it('returns "Roughly even chance" for probability 50', () => {
    expect(probabilityToTerm(50).primary).toBe('Roughly even chance');
  });

  it('returns "Likely" for probability 70', () => {
    expect(probabilityToTerm(70).primary).toBe('Likely');
  });

  it('returns "Very likely" for probability 90', () => {
    expect(probabilityToTerm(90).primary).toBe('Very likely');
  });

  it('returns "Almost certainly" for probability 97', () => {
    expect(probabilityToTerm(97).primary).toBe('Almost certainly');
  });

  it('clamps values below 1 to 1', () => {
    expect(probabilityToTerm(0).primary).toBe('Almost no chance');
  });

  it('clamps values above 99 to 99', () => {
    expect(probabilityToTerm(100).primary).toBe('Almost certainly');
  });

  it('always returns a defined term', () => {
    for (let p = 0; p <= 100; p++) {
      expect(probabilityToTerm(p)).toBeDefined();
    }
  });
});

describe('deriveConfidence', () => {
  it('returns HIGH for high trust + corroborated', () => {
    expect(deriveConfidence(0.8, true, true)).toBe('HIGH');
  });

  it('returns HIGH for trust just above 0.7 + corroborated', () => {
    expect(deriveConfidence(0.71, true, true)).toBe('HIGH');
  });

  it('returns MODERATE for moderate trust + corroborated', () => {
    expect(deriveConfidence(0.55, true, true)).toBe('MODERATE');
  });

  it('returns MODERATE for high trust but not corroborated (known outlet)', () => {
    expect(deriveConfidence(0.8, false, true)).toBe('MODERATE');
  });

  it('returns LOW for trust below 0.4', () => {
    expect(deriveConfidence(0.35, true, true)).toBe('LOW');
  });

  it('returns LOW for uncorroborated + unknown outlet', () => {
    expect(deriveConfidence(0.5, false, false)).toBe('LOW');
  });
});

describe('formatConfidenceExplanation', () => {
  it('formats HIGH confidence correctly', () => {
    const result = formatConfidenceExplanation('HIGH', 0.82, true, 3);
    expect(result).toContain('HIGH CONFIDENCE');
    expect(result).toContain('3 corroborating');
    expect(result).toContain('82%');
  });

  it('formats MODERATE confidence with single source', () => {
    const result = formatConfidenceExplanation('MODERATE', 0.65, false, 1);
    expect(result).toContain('MODERATE CONFIDENCE');
    expect(result).toContain('single source');
    expect(result).toContain('65%');
  });

  it('formats LOW confidence with unverified flag', () => {
    const result = formatConfidenceExplanation('LOW', 0.35, false, 1);
    expect(result).toContain('LOW CONFIDENCE');
    expect(result).toContain('unverified');
  });
});

describe('formatProbabilityTableForPrompt', () => {
  it('contains all 7 primary terms', () => {
    const output = formatProbabilityTableForPrompt();
    for (const term of IC_PROBABILITY_TABLE) {
      expect(output).toContain(term.primary);
    }
  });

  it('contains the ICD 203 header', () => {
    expect(formatProbabilityTableForPrompt()).toContain('ICD 203');
  });

  it('contains prohibition on "maybe"', () => {
    expect(formatProbabilityTableForPrompt()).toContain('"maybe,"');
  });
});

describe('formatConfidenceFrameworkForPrompt', () => {
  it('contains HIGH, MODERATE, LOW descriptions', () => {
    const output = formatConfidenceFrameworkForPrompt();
    expect(output).toContain('HIGH');
    expect(output).toContain('MODERATE');
    expect(output).toContain('LOW');
  });

  it('clarifies confidence vs certainty distinction', () => {
    expect(formatConfidenceFrameworkForPrompt()).toContain('EVIDENCE QUALITY');
  });
});
