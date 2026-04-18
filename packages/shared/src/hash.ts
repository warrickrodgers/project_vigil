import { createHash } from 'crypto';

/**
 * Normalise a string for stable hashing:
 * trim leading/trailing whitespace, collapse internal runs of whitespace to a
 * single space, convert to lowercase.
 */
function normalise(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Compute a stable sha256 deduplication hash for an article.
 *
 * Hash input = normalised(title) + "\n" + normalised(rawContent)
 *
 * Using rawContent (not the LLM summary) means two collectors that fetch the
 * same wire story will produce the same hash regardless of how each summarises
 * it. Pass an empty string for rawContent when the fetch failed — the hash
 * will still be stable and unique per title.
 */
export function computeArticleHash(title: string, rawContent: string): string {
  const input = `${normalise(title)}\n${normalise(rawContent)}`;
  return createHash('sha256').update(input, 'utf8').digest('hex');
}
