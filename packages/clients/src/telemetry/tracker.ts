import fs from 'node:fs/promises';
import path from 'node:path';
import type { APICallEvent } from './types.js';
import { logger } from './logger.js';

const MAX_BUFFER = 1000;
const FLUSH_INTERVAL_MS = 60_000;

export class APICallTracker {
  private calls: APICallEvent[] = [];
  private readonly telemetryDir: string;
  private flushInterval: NodeJS.Timeout;

  constructor(options?: { telemetryDir?: string }) {
    const dataRoot = process.env['AWS_LAMBDA_FUNCTION_NAME'] ? '/tmp' : process.cwd();
    this.telemetryDir = options?.telemetryDir ?? path.join(dataRoot, 'data', 'telemetry');
    this.flushInterval = setInterval(() => { void this.flush(); }, FLUSH_INTERVAL_MS);
    this.flushInterval.unref();
  }

  record(event: APICallEvent): void {
    if (this.calls.length >= MAX_BUFFER) {
      this.calls.shift();
    }
    this.calls.push(event);
  }

  getSummary(since?: Date): {
    totalCalls: number;
    totalTokens: number;
    estimatedCostUSD: number;
    byProvider: Record<string, { calls: number; tokens: number; cost: number }>;
    byLabel: Record<string, { calls: number; avgLatencyMs: number }>;
    errorRate: number;
  } {
    const filtered = since !== undefined ? this.calls.filter(c => c.timestamp >= since) : this.calls;

    const byProvider: Record<string, { calls: number; tokens: number; cost: number }> = {};
    const byLabelAccum: Record<string, { calls: number; totalLatency: number }> = {};
    let totalTokens = 0;
    let estimatedCostUSD = 0;
    let errorCount = 0;

    for (const c of filtered) {
      totalTokens += c.totalTokens;
      estimatedCostUSD += c.estimatedCostUSD;
      if (!c.success) errorCount++;

      const provEntry = byProvider[c.provider] ?? { calls: 0, tokens: 0, cost: 0 };
      provEntry.calls++;
      provEntry.tokens += c.totalTokens;
      provEntry.cost += c.estimatedCostUSD;
      byProvider[c.provider] = provEntry;

      const lblEntry = byLabelAccum[c.label] ?? { calls: 0, totalLatency: 0 };
      lblEntry.calls++;
      lblEntry.totalLatency += c.latencyMs;
      byLabelAccum[c.label] = lblEntry;
    }

    const byLabel: Record<string, { calls: number; avgLatencyMs: number }> = {};
    for (const [label, entry] of Object.entries(byLabelAccum)) {
      byLabel[label] = {
        calls: entry.calls,
        avgLatencyMs: entry.calls > 0 ? entry.totalLatency / entry.calls : 0,
      };
    }

    return {
      totalCalls: filtered.length,
      totalTokens,
      estimatedCostUSD,
      byProvider,
      byLabel,
      errorRate: filtered.length > 0 ? errorCount / filtered.length : 0,
    };
  }

  async flush(): Promise<void> {
    if (this.calls.length === 0) return;
    const toFlush = this.calls.splice(0);
    const date = new Date().toISOString().slice(0, 10);
    const file = path.join(this.telemetryDir, `${date}.jsonl`);
    try {
      await fs.mkdir(this.telemetryDir, { recursive: true });
      const lines = toFlush.map(c => JSON.stringify(c)).join('\n') + '\n';
      await fs.appendFile(file, lines, 'utf-8');
      logger.debug('Telemetry flushed', { file, count: toFlush.length });
    } catch (err) {
      // Put events back so they're not lost
      this.calls.unshift(...toFlush);
      logger.error('Failed to flush telemetry', err instanceof Error ? err : new Error(String(err)));
    }
  }

  stop(): void {
    clearInterval(this.flushInterval);
  }
}
