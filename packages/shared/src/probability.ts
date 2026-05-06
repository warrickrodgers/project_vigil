/**
 * ICD 203 Analytic Standards — Probability Language
 *
 * Source: Intelligence Community Directive 203 (DNI, revised January 2015)
 * Reference: PMC6469752 (Wintle et al. 2019) Table 1 — confirmed ranges
 *
 * These terms are injected into every analyst assessment prompt to ensure
 * consistent, auditable probability language across all Vigil output.
 */

export interface ProbabilityTerm {
  primary: string;
  alternate: string;
  rangeMin: number;
  rangeMax: number;
  usage: string;
}

export const IC_PROBABILITY_TABLE: ProbabilityTerm[] = [
  {
    primary: 'Almost no chance',
    alternate: 'Remote',
    rangeMin: 1,
    rangeMax: 5,
    usage: 'Event would require multiple independent failures or unprecedented reversal of established trends',
  },
  {
    primary: 'Very unlikely',
    alternate: 'Highly improbable',
    rangeMin: 5,
    rangeMax: 20,
    usage: 'Event conflicts with established patterns and most available evidence, but cannot be ruled out',
  },
  {
    primary: 'Unlikely',
    alternate: 'Improbable',
    rangeMin: 20,
    rangeMax: 45,
    usage: 'Evidence weighs against this outcome, but significant uncertainty remains',
  },
  {
    primary: 'Roughly even chance',
    alternate: 'Roughly even odds',
    rangeMin: 45,
    rangeMax: 55,
    usage: 'Available evidence does not favor either outcome; genuinely uncertain',
  },
  {
    primary: 'Likely',
    alternate: 'Probable',
    rangeMin: 55,
    rangeMax: 80,
    usage: 'Evidence and established patterns favor this outcome, though alternatives remain plausible',
  },
  {
    primary: 'Very likely',
    alternate: 'Highly probable',
    rangeMin: 80,
    rangeMax: 95,
    usage: 'Strong evidence and multiple indicators support this outcome; would require significant new information to change assessment',
  },
  {
    primary: 'Almost certainly',
    alternate: 'Nearly certain',
    rangeMin: 95,
    rangeMax: 99,
    usage: 'All available evidence and established patterns support this outcome; only a major unforeseen development would alter assessment',
  },
];

/**
 * Given a numeric probability (0-100), return the matching IC term.
 */
export function probabilityToTerm(probability: number): ProbabilityTerm {
  const clamped = Math.max(1, Math.min(99, probability));
  const match = IC_PROBABILITY_TABLE.find(
    (t) => clamped >= t.rangeMin && clamped <= t.rangeMax,
  );
  return match ?? IC_PROBABILITY_TABLE[3]!;
}

/**
 * Format the probability table as a string block for prompt injection.
 */
export function formatProbabilityTableForPrompt(): string {
  const header = 'USE THESE IC-STANDARD PROBABILITY TERMS (ICD 203):\n';
  const rows = IC_PROBABILITY_TABLE.map(
    (t) => `  "${t.primary}" (or "${t.alternate}"): ${t.rangeMin}-${t.rangeMax}% — ${t.usage}`,
  ).join('\n');
  const footer =
    '\n\nNEVER use non-standard probability language. ' +
    'NEVER say "maybe," "perhaps," "could potentially," "might," or "remains to be seen." ' +
    'Always commit to one of the seven terms above with explicit reasoning.';
  return header + rows + footer;
}

// ---------------------------------------------------------------------------
// Confidence levels
// ---------------------------------------------------------------------------

export type ConfidenceLevel = 'HIGH' | 'MODERATE' | 'LOW';

export interface ConfidenceAssessment {
  level: ConfidenceLevel;
  reasoning: string;
}

/**
 * Derive confidence level from trust/corroboration data. Deterministic — no LLM needed.
 */
export function deriveConfidence(
  trustScore: number,
  isCorroborated: boolean,
  outletKnown: boolean,
): ConfidenceLevel {
  if (trustScore > 0.7 && isCorroborated) return 'HIGH';
  if (trustScore < 0.4 || (!isCorroborated && !outletKnown)) return 'LOW';
  return 'MODERATE';
}

/**
 * Format confidence level with explanation for newsletter rendering.
 */
export function formatConfidenceExplanation(
  level: ConfidenceLevel,
  trustScore: number,
  isCorroborated: boolean,
  sourceCount: number,
): string {
  switch (level) {
    case 'HIGH':
      return `HIGH CONFIDENCE — ${sourceCount} corroborating sources, trust score ${(trustScore * 100).toFixed(0)}%`;
    case 'MODERATE':
      return `MODERATE CONFIDENCE — ${isCorroborated ? 'corroborated' : 'single source'}, trust score ${(trustScore * 100).toFixed(0)}%`;
    case 'LOW':
      return `LOW CONFIDENCE — ${isCorroborated ? '' : 'unverified, '}trust score ${(trustScore * 100).toFixed(0)}%`;
  }
}

/**
 * Format the confidence framework as a string block for prompt injection.
 */
export function formatConfidenceFrameworkForPrompt(): string {
  return `CONFIDENCE LEVELS (assign one to every assessment):
  HIGH — Multiple corroborating sources from reliable outlets. Trust score > 70%.
         Use when: evidence is strong and cross-verified.
  MODERATE — Single credible source, or partially corroborated. Trust 40-70%.
             Use when: evidence is plausible but not fully verified.
  LOW — Unverified, single source, or unknown outlet. Trust < 40%.
        Use when: reporting but cannot validate. Always flag what would raise confidence.

IMPORTANT: Confidence is about EVIDENCE QUALITY, not about how certain you are.
A HIGH confidence + "unlikely" assessment is valid:
"We assess with HIGH CONFIDENCE that a rate cut is UNLIKELY (20-45%) this quarter."
This means: we have strong evidence, and that evidence points to no cut.`;
}
