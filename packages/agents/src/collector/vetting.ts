import { computeTrustRating } from '@vigil/shared';
import type { ArticleVettingResult, VettingFlag } from '@vigil/shared';
import type { OutletRecord } from './types.js';

const BIAS_FLAG_THRESHOLD = 0.5;
const LOW_TRUST_THRESHOLD = 0.25;
const AUTO_APPROVE_TRUST_THRESHOLD = 0.6;
const AUTO_APPROVE_BIAS_THRESHOLD = 0.5;
// Provisional reliability for outlets not yet in the registry
const PROVISIONAL_RELIABILITY = 0.5;

export interface VettingInput {
  geminiResult: {
    summary: string;
    actionableIntel: string;
    biasScore: number;
    sectorTags: import('@vigil/shared').SectorTag[];
    outletName: string;
    estimatedPublishDate: string;
  };
  outlet: OutletRecord | null;
  outletBiasAnchor: number;
  isCorroborated: boolean;
}

export function computeVettingResult(input: VettingInput): ArticleVettingResult {
  const { geminiResult, outlet, outletBiasAnchor, isCorroborated } = input;

  const outletKnown = outlet !== null;
  // Known outlets use their seeded reliabilityBase; unknown outlets start at 0.5 provisional
  const reliabilityBase = outletKnown ? outlet.reliabilityBase : PROVISIONAL_RELIABILITY;

  const blendedBias = Math.max(-1, Math.min(1, (geminiResult.biasScore + outletBiasAnchor) / 2));

  const trustScore = computeTrustRating(blendedBias, isCorroborated ? 1 : 0, reliabilityBase);

  const flag = deriveFlag({ trustScore, blendedBias, outletKnown, isCorroborated });

  const autoApprove =
    trustScore > AUTO_APPROVE_TRUST_THRESHOLD &&
    Math.abs(blendedBias) < AUTO_APPROVE_BIAS_THRESHOLD &&
    isCorroborated &&
    outletKnown;

  return {
    summary: geminiResult.summary,
    actionableIntel: geminiResult.actionableIntel,
    biasScore: blendedBias,
    sectorTags: geminiResult.sectorTags,
    outletName: geminiResult.outletName,
    estimatedPublishDate: geminiResult.estimatedPublishDate,
    trustScore,
    isCorroborated,
    outletKnown,
    autoApprove,
    flag,
  };
}

function deriveFlag(args: {
  trustScore: number;
  blendedBias: number;
  outletKnown: boolean;
  isCorroborated: boolean;
}): VettingFlag | null {
  const { trustScore, blendedBias, outletKnown, isCorroborated } = args;

  if (!outletKnown) return 'UNKNOWN_OUTLET';
  if (trustScore < LOW_TRUST_THRESHOLD) return 'LOW_TRUST';
  if (Math.abs(blendedBias) > BIAS_FLAG_THRESHOLD) return 'BIAS';
  if (!isCorroborated) return 'UNVERIFIED';
  return null;
}

export const FLAG_LABELS: Record<VettingFlag, string> = {
  BIAS: '⚠️ BIAS',
  UNVERIFIED: '🔍 UNVERIFIED',
  DUPLICATE: '♻️ DUPLICATE',
  LOW_TRUST: '📉 LOW TRUST',
  UNKNOWN_OUTLET: '❓ UNKNOWN OUTLET',
};
