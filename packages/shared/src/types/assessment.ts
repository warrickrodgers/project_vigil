import { z } from 'zod';
import type { ConfidenceLevel } from '../probability.js';

/**
 * Structured analyst assessment following IC analytic tradecraft standards.
 * Every section assessment and cross-sector analysis must follow this structure.
 */
export interface StructuredAssessment {
  /** Facts only — named actors, numbers, dates, locations. No editorializing. */
  situation: string;

  /** Committed, probability-weighted analysis using IC-standard terms.
   *  Analyzes through incentive frameworks. Identifies patterns, not just events. */
  assessment: string;

  /** Evidence quality — HIGH/MODERATE/LOW */
  confidence: ConfidenceLevel;
  confidenceReasoning: string;

  /** What the reader should do, prepare for, or watch. Specific and operational. */
  implications: string;

  /** Specific, observable indicators that would confirm or contradict the assessment. */
  watchList: string[];
}

export const StructuredAssessmentSchema = z.object({
  situation: z.string().min(30, 'Situation must contain specific facts'),
  assessment: z.string().min(30, 'Assessment must be substantive'),
  confidence: z.enum(['HIGH', 'MODERATE', 'LOW']),
  confidenceReasoning: z.string().min(10),
  implications: z.string().min(20),
  watchList: z.array(z.string()).min(1).max(5),
});
