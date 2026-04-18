import { EmbedBuilder } from 'discord.js';
import type { RegionStatus } from '../types.js';

function fmt(date: Date | null): string {
  return date ? date.toISOString() : 'Never';
}

export function formatStatusEmbed(
  statuses: RegionStatus[],
  newsletterLastSent?: Date | null,
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle('📊 Vigil Operational Status')
    .setTimestamp();

  for (const s of statuses) {
    embed.addFields({
      name: s.region.toUpperCase(),
      value: [
        `Last run: ${fmt(s.lastCollectionTime)}`,
        `Articles: ${s.articlesCollected}`,
        `Next run: ${fmt(s.nextScheduledRun)}`,
        `Outlets: ${s.outletCount}`,
      ].join('\n'),
      inline: true,
    });
  }

  embed.addFields({
    name: 'Newsletter',
    value: `Last dispatch: ${fmt(newsletterLastSent ?? null)}`,
  });

  return embed;
}
