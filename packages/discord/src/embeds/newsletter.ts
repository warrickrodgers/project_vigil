import { EmbedBuilder } from 'discord.js';
import type { ArticleForEmbed, DigestSections } from '../types.js';

const SECTION_META = {
  local: { label: '📍 LOCAL INTEL', color: 0x3498db },
  usa: { label: '🇺🇸 USA INTEL', color: 0xe74c3c },
  geopolitical: { label: '🌐 GEOPOLITICAL INTEL', color: 0x9b59b6 },
} as const;

function buildSectionEmbed(
  region: keyof typeof SECTION_META,
  articles: ArticleForEmbed[],
  timestamp: Date,
): EmbedBuilder {
  const meta = SECTION_META[region];
  const embed = new EmbedBuilder()
    .setColor(meta.color)
    .setTitle(meta.label)
    .setFooter({ text: `${articles.length} article(s) · ${timestamp.toISOString()}` });

  const top = articles.slice(0, 4);
  for (const article of top) {
    const summary =
      article.summary.length > 120 ? article.summary.slice(0, 117) + '...' : article.summary;
    embed.addFields({ name: article.title, value: summary });
  }

  if (top.length === 0) {
    embed.setDescription('No articles collected for this region.');
  }

  return embed;
}

export function formatNewsletterDigest(sections: DigestSections): EmbedBuilder[] {
  const timestamp = new Date();
  return [
    buildSectionEmbed('local', sections.local, timestamp),
    buildSectionEmbed('usa', sections.usa, timestamp),
    buildSectionEmbed('geopolitical', sections.geopolitical, timestamp),
  ];
}
