import type { ArticleRow, RankedArticle } from './types.js';

const RECENCY_HALF_LIFE_HOURS = 12;
const CORROBORATION_BONUS = 0.25;
const MIN_TRUST_THRESHOLD = 0.2;

export function rankArticles(articles: ArticleRow[], nowMs: number): RankedArticle[] {
  return articles
    .filter((a) => a.trustRating >= MIN_TRUST_THRESHOLD)
    .map((a) => {
      const ageHours = (nowMs - new Date(a.collectedAt).getTime()) / (1000 * 60 * 60);
      const recency = Math.exp(-ageHours / RECENCY_HALF_LIFE_HOURS);
      const isCorroborated = a.corroboratedById !== null;
      const corrobBonus = isCorroborated ? CORROBORATION_BONUS : 0;
      const rankScore = (a.trustRating + corrobBonus) * recency;
      return { ...a, rankScore, isCorroborated };
    })
    .sort((a, b) => b.rankScore - a.rankScore);
}

export function computeNewsletterStats(articles: ArticleRow[]): import('./types.js').NewsletterStats {
  if (articles.length === 0) {
    return {
      totalArticles: 0,
      corroborationRate: 0,
      avgTrustRating: 0,
      avgBiasScore: 0,
      sectorCounts: { local: 0, usa: 0, geopolitical: 0 },
    };
  }
  const corroborated = articles.filter((a) => a.corroboratedById !== null).length;
  const avgTrust = articles.reduce((s, a) => s + a.trustRating, 0) / articles.length;
  const avgBias = articles.reduce((s, a) => s + a.biasScore, 0) / articles.length;
  return {
    totalArticles: articles.length,
    corroborationRate: corroborated / articles.length,
    avgTrustRating: Math.round(avgTrust * 100) / 100,
    avgBiasScore: Math.round(avgBias * 100) / 100,
    sectorCounts: {
      local: articles.filter((a) => a.region === 'local').length,
      usa: articles.filter((a) => a.region === 'usa').length,
      geopolitical: articles.filter((a) => a.region === 'geopolitical').length,
    },
  };
}
