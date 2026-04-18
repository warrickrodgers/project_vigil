import { EmbedBuilder } from 'discord.js';
import type { ArticleForEmbed } from '../types.js';

function biasBar(score: number): string {
  // Maps -1..1 to a 10-char bar with pointer
  const pos = Math.round((score + 1) * 5); // 0-10
  const bar = Array.from({ length: 11 }, (_, i) => (i === pos ? '▼' : '─')).join('');
  return `L ${bar} R  (${score >= 0 ? '+' : ''}${score.toFixed(2)})`;
}

export function formatBiasAlertEmbed(
  article: ArticleForEmbed,
  outletName: string,
  reason: string,
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle('⚠️ BIAS REVIEW REQUIRED')
    .addFields(
      { name: 'Headline', value: article.title },
      { name: 'Outlet', value: outletName, inline: true },
      { name: 'Bias Score', value: biasBar(article.biasScore), inline: true },
      { name: 'Reason', value: reason },
      { name: 'Source', value: article.url },
    )
    .setFooter({ text: `Article ID: ${article.id}` });
}
