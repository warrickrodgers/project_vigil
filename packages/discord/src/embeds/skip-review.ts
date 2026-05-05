import { EmbedBuilder } from 'discord.js';
import type { SkipReviewRequest } from '../types.js';

const REASON_LABELS: Record<SkipReviewRequest['reason'], string> = {
  unknown_outlet: 'Unknown Outlet',
  low_trust: 'Low Trust Rating',
  single_source_high_bias: 'Single Source + Elevated Bias',
};

export function formatSkipReviewEmbed(request: SkipReviewRequest): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x95a5a6) // neutral grey — this is informational, not an alarm
    .setTitle(`🔍 Skip Review: ${REASON_LABELS[request.reason]}`)
    .addFields(
      { name: 'Headline', value: request.article.title },
      { name: 'Outlet (detected)', value: request.outletName, inline: true },
      { name: 'Domain', value: request.domain, inline: true },
      { name: 'Region', value: request.region.toUpperCase(), inline: true },
      { name: 'Agent Bias Score', value: request.agentBiasScore.toFixed(2), inline: true },
      {
        name: 'Agent Trust Rating',
        value: `${(request.agentTrustRating * 100).toFixed(0)}%`,
        inline: true,
      },
      { name: '​', value: '​', inline: true },
      { name: 'Reason', value: request.reasonDetail },
      { name: 'Summary', value: request.article.summary },
      { name: 'Source', value: request.article.url },
    )
    .setFooter({
      text: `Agent wants to skip · Trust rating preserved if kept · Request ID: ${request.id}`,
    });
}
