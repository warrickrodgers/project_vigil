import { prisma } from '@vigil/db';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio";
import { z } from "zod";
import type { Region } from '@vigil/shared';
import { loadBudgetState, saveBudgetState } from '../../services/lib/db-budget';
import { APICallTracker, GeminiClient, TavilyClient, TavilySearchResult, SearchBudget, ChromaClient, logger } from '@vigil/clients';
import { beforeToolCall } from './hooks/before-tool';

const loaded = await loadBudgetState(prisma);
const budget = new SearchBudget({
    ...(loaded !== null ? { initialState: loaded } : {}),
    disableFilePersistence: true,
});

const tracker = new APICallTracker();
const tavily = new TavilyClient(process.env['TAVILY_API_KEY'] ?? '', tracker, budget);

const server = new McpServer({
    name: "project-vigil-mcp",
    version: "1.0.0"
})

server.registerTool(
    "get_articles",
    {
        description: "Get articles for the Vigil agent to vet and corroborate",
        inputSchema: {
            queries: z.array(z.string()),
            region: z.enum(['local', 'usa', 'geopolitical']),
            maxResults: z.number().optional().default(10),
            searchDepth: z.enum(['basic', 'advanced']).optional().default('basic'),
            days: z.number().optional().default(10)
        }
    },
    async ({queries, region, maxResults, searchDepth, days}) => {
        await beforeToolCall("get_articles", {queries, region, maxResults, searchDepth, days});
        const results: TavilySearchResult[] = [];
        const seen = new Set<string>();

        for (const query of queries) {
            try {
                const hits = await tavily.search(query, { searchDepth, maxResults, days, label: `collect-${region}` });
                for (const hit of hits) {
                    if (!seen.has(hit.url)) {
                        seen.add(hit.url);
                        results.push(hit);
                    }
                }
            } catch (err) {
                logger.warn('Search failed for query, continuing', {
                query,
                error: err instanceof Error ? err.message : String(err),
                });
            }
        }

        return {
            content: [{
                type: "text" as const,
                text: JSON.stringify(results),
            }]
        }
    }
)