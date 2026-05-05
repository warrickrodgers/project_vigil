import type { ArticleRow } from './types.js';

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'has', 'have', 'had', 'as', 'its', 'it', 'this', 'that', 'new', 'says',
  'said', 'will', 'after', 'amid', 'over', 'as', 'up', 'out', 'us', 'into',
]);

const JACCARD_THRESHOLD = 0.28;
const TRUST_BOOST = 0.12; // applied to corroborated articles

function tokenize(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP_WORDS.has(w)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let intersection = 0;
  for (const w of a) {
    if (b.has(w)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export interface CorroborationResult {
  articles: ArticleRow[];
  pairs: Array<{ primaryId: string; secondaryId: string; similarity: number }>;
}

export function detectCorroborations(articles: ArticleRow[]): CorroborationResult {
  const tokenized = articles.map((a) => ({ article: a, tokens: tokenize(a.title) }));
  const pairs: CorroborationResult['pairs'] = [];
  const secondaryIds = new Set<string>();

  for (let i = 0; i < tokenized.length; i++) {
    for (let j = i + 1; j < tokenized.length; j++) {
      const a = tokenized[i]!;
      const b = tokenized[j]!;
      if (a.article.region !== b.article.region) continue; // only within-region corroboration in Phase 1
      const sim = jaccard(a.tokens, b.tokens);
      if (sim >= JACCARD_THRESHOLD) {
        // Higher trust article becomes the primary
        const [primary, secondary] =
          a.article.trustRating >= b.article.trustRating
            ? [a.article, b.article]
            : [b.article, a.article];
        if (!secondaryIds.has(primary.id)) {
          pairs.push({ primaryId: primary.id, secondaryId: secondary.id, similarity: sim });
          secondaryIds.add(secondary.id);
        }
      }
    }
  }

  // Apply corroboration: update corroboratedById and bump trust
  const corrobMap = new Map(pairs.map((p) => [p.secondaryId, p.primaryId]));
  const updated = articles.map((a) => {
    const primaryId = corrobMap.get(a.id);
    if (primaryId !== undefined) {
      return {
        ...a,
        corroboratedById: primaryId,
        trustRating: Math.min(1, a.trustRating + TRUST_BOOST),
      };
    }
    return a;
  });

  return { articles: updated, pairs };
}
