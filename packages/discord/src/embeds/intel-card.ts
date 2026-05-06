import { EmbedBuilder } from 'discord.js';
import type { ArticleForEmbed } from '../types.js';
import { deriveConfidence } from '@vigil/shared';

function priorityColor(trustRating: number): number {
  if (trustRating < 0.4) return 0xe74c3c; // red
  if (trustRating < 0.7) return 0xf39c12; // amber
  return 0x2ecc71;                         // green
}

function biasLabel(score: number): string {
  if (score <= -0.6) return 'Hard Left';
  if (score <= -0.2) return 'Left-Leaning';
  if (score < 0.2) return 'Center';
  if (score < 0.6) return 'Right-Leaning';
  return 'Hard Right';
}

function trustBar(rating: number): string {
  const filled = Math.round(rating * 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled) + ` ${(rating * 100).toFixed(0)}%`;
}

const FLAG_LABELS: Record<string, string> = {
  BIAS: '⚠️ BIAS',
  UNVERIFIED: '🔍 UNVERIFIED',
  DUPLICATE: '♻️ DUPLICATE',
  LOW_TRUST: '📉 LOW TRUST',
  UNKNOWN_OUTLET: '❓ UNKNOWN OUTLET',
};

const CONFIDENCE_BADGES: Record<string, string> = {
  HIGH: '🟢 HIGH',
  MODERATE: '🟡 MODERATE',
  LOW: '🔴 LOW',
};

export function formatIntelEmbed(article: ArticleForEmbed, outletName: string): EmbedBuilder {
  const flagLabel = article.vettingFlag ? FLAG_LABELS[article.vettingFlag] ?? article.vettingFlag : null;

  // Derive confidence from available trust data; outletKnown approximated from trust
  const isCorroborated = 'isCorroborated' in article
    ? (article as ArticleForEmbed & { isCorroborated?: boolean }).isCorroborated ?? false
    : false;
  const outletKnown = article.trustRating > 0.3; // provisional heuristic
  const confidence = deriveConfidence(article.trustRating, isCorroborated, outletKnown);
  const confidenceBadge = CONFIDENCE_BADGES[confidence] ?? CONFIDENCE_BADGES['MODERATE']!;

  const embed = new EmbedBuilder()
    .setColor(priorityColor(article.trustRating))
    .setTitle(article.title)
    .setURL(article.url)
    .addFields(
      { name: 'Region', value: article.region.toUpperCase(), inline: true },
      {
        name: 'Outlet',
        value: `${outletName} · ${biasLabel(article.biasScore)}`,
        inline: true,
      },
      { name: 'Trust Rating', value: trustBar(article.trustRating), inline: true },
      { name: 'Confidence', value: confidenceBadge, inline: true },
      { name: 'Summary', value: article.summary },
    )
    .setFooter({
      text: `Collected ${article.collectedAt.toISOString()} · ID: ${article.id}${flagLabel ? ` · ${flagLabel}` : ''}`,
    });

  if (article.actionableIntel) {
    embed.addFields({ name: 'Actionable Intel', value: article.actionableIntel });
  }

  if (flagLabel) {
    embed.addFields({ name: 'Vetting Status', value: flagLabel });
  }

  return embed;
}

/**
 * NOMINAL variant — sent when a sector has no new developments.
 */
export function formatNominalEmbed(region: string, lastCollectionAt?: Date): EmbedBuilder {
  const regionLabel = region.toUpperCase();
  const lastCollection = lastCollectionAt
    ? lastCollectionAt.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Chicago',
        timeZoneName: 'short',
      })
    : 'Unknown';

  return new EmbedBuilder()
    .setColor(0x444455)
    .setTitle(`📊 ${regionLabel} — NOMINAL`)
    .setDescription(
      `No new developments in the last 18 hours.\nMonitoring continues. Last collection: ${lastCollection}.`,
    )
    .setFooter({ text: 'Vigil is watching.' });
}
