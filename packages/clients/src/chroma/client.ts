import { ChromaClient as ChromaHttpClient, CloudClient } from 'chromadb';
import type { Collection, QueryRowResult } from 'chromadb';
import { logger } from '../telemetry/logger.js';

const COLLECTION_NAME = 'vigil-articles';
const SIMILARITY_THRESHOLD = 0.85;

export interface ArticleMetadata extends Record<string, string | number | boolean> {
  outletId: string;
  region: string;
  title: string;
}

export interface SimilarArticle {
  articleId: string;
  outletId: string;
  region: string;
  score: number;
}

export class ChromaClient {
  private readonly client: ChromaHttpClient;
  private collection: Collection | null = null;

  constructor() {
    const apiKey = process.env['CHROMADB_CLOUD_API_KEY'];
    const tenant = process.env['CHROMADB_CLOUD_TENANT_ID'];

    if (apiKey && tenant) {
      this.client = new CloudClient({ apiKey, tenant, database: 'project_vigil_prod' });
    } else {
      const url = process.env['CHROMA_URL'] ?? 'http://localhost:8000';
      const parsed = new URL(url);
      this.client = new ChromaHttpClient({
        host: parsed.hostname,
        port: parsed.port ? parseInt(parsed.port, 10) : (parsed.protocol === 'https:' ? 443 : 8000),
        ssl: parsed.protocol === 'https:',
      });
    }
  }

  async isReachable(): Promise<boolean> {
    try {
      await this.client.heartbeat();
      return true;
    } catch {
      return false;
    }
  }

  private async getCollection(): Promise<Collection> {
    if (!this.collection) {
      this.collection = await this.client.getOrCreateCollection({
        name: COLLECTION_NAME,
        configuration: { hnsw: { space: 'cosine' } },
      });
    }
    return this.collection;
  }

  async upsertArticle(
    articleId: string,
    embedding: number[],
    metadata: ArticleMetadata,
  ): Promise<void> {
    const col = await this.getCollection();
    await col.upsert({
      ids: [articleId],
      embeddings: [embedding],
      metadatas: [metadata],
    });
  }

  async querySimilar(
    embedding: number[],
    excludeOutletId: string,
    topK: number = 5,
  ): Promise<SimilarArticle[]> {
    try {
      const col = await this.getCollection();
      const results = await col.query({
        queryEmbeddings: [embedding],
        nResults: topK,
        // Legacy Where object — { field: { $ne: value } }
        where: { outletId: { $ne: excludeOutletId } } as never,
      });

      const rows: QueryRowResult[] = results.rows()[0] ?? [];
      return rows
        .filter((r) => r.distance !== null && r.distance !== undefined)
        .map((r) => {
          const meta = (r.metadata ?? {}) as Partial<ArticleMetadata>;
          return {
            articleId: r.id,
            outletId: meta.outletId ?? '',
            region: meta.region ?? '',
            score: 1 - (r.distance ?? 1),
          };
        })
        .filter((a) => a.score >= SIMILARITY_THRESHOLD);
    } catch (err) {
      logger.warn('ChromaDB query failed — skipping corroboration', {
        error: err instanceof Error ? err.message : String(err),
      });
      return [];
    }
  }
}
