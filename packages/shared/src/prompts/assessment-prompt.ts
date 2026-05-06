import { ANALYST_VOICE_DIRECTIVE, PROHIBITED_PHRASES } from './analyst-voice.js';
import { formatProbabilityTableForPrompt, formatConfidenceFrameworkForPrompt } from '../probability.js';

/**
 * Assemble the full analyst system prompt.
 * Injected into every Gemini call that produces analyst assessment output.
 */
export function buildAnalystSystemPrompt(): string {
  return [
    ANALYST_VOICE_DIRECTIVE,
    formatProbabilityTableForPrompt(),
    formatConfidenceFrameworkForPrompt(),
    PROHIBITED_PHRASES,
    `OUTPUT STRUCTURE — every assessment must follow this exact JSON structure:

{
  "situation": "Facts only. Named actors, numbers, dates, locations. No editorializing.",
  "assessment": "Committed, probability-weighted analysis using IC-standard terms. Analyze through incentive frameworks. Identify patterns, not just events. Connect across scales (local ↔ national ↔ global) where relevant.",
  "confidence": "HIGH | MODERATE | LOW",
  "confidenceReasoning": "Explicit reasoning citing source count, corroboration, outlet reliability.",
  "implications": "What should the reader do, prepare for, or watch. Must be specific and operational.",
  "watchList": ["Specific observable indicator #1", "Specific observable indicator #2", "Specific observable indicator #3"]
}`,
  ].join('\n\n---\n\n');
}

/**
 * Assemble the article vetting system prompt.
 * Used for the unified vetting call that produces summary + actionableIntel.
 */
export function buildVettingSystemPrompt(): string {
  return [
    `You are an intelligence analyst extracting actionable intelligence from open sources.`,
    PROHIBITED_PHRASES,
    `SUMMARY EXTRACTION RULES:
- Extract specific facts, events, decisions, numbers, dates, and named actors
- NEVER describe what the article or publication is about
- NEVER describe the source itself
- Every sentence must contain a specific, verifiable fact
- If the article contains no extractable facts, return summary: "NO EXTRACTABLE INTELLIGENCE"

BAD: "The Kansas City Star reports on local government activities and budget decisions."
GOOD: "Kansas City Council approved $200M BRT corridor expansion. Groundbreak Q3 2026, service target 2028. Route: Troost Ave downtown to 85th St. Federal match: $120M FTA."

ACTIONABLE INTEL RULES:
- State what the reader should DO, PREPARE FOR, or MONITOR
- Reference specific timelines, locations, dollar amounts, deadlines
- Connect to the reader's operational context (their neighborhood, their taxes, their industry)
- "This may impact the community" is NOT acceptable`,
  ].join('\n\n');
}
