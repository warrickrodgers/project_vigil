import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { APICallTracker } from '../telemetry/tracker.js';
import type { APICallEvent } from '../telemetry/types.js';

function makeEvent(overrides?: Partial<APICallEvent>): APICallEvent {
  return {
    provider: 'gemini',
    model: 'gemini-test',
    tier: 'fast',
    label: 'test',
    inputTokens: 100,
    outputTokens: 50,
    totalTokens: 150,
    estimatedCostUSD: 0.001,
    latencyMs: 120,
    success: true,
    retryCount: 0,
    timestamp: new Date(),
    ...overrides,
  };
}

describe('APICallTracker', () => {
  let tmpDir: string;
  let tracker: APICallTracker;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vigil-tracker-'));
    tracker = new APICallTracker({ telemetryDir: tmpDir });
  });

  afterEach(() => {
    tracker.stop();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('record() adds events to buffer', () => {
    tracker.record(makeEvent());
    expect(tracker.getSummary().totalCalls).toBe(1);
  });

  it('getSummary() aggregates totalTokens and cost across all events', () => {
    tracker.record(makeEvent({ totalTokens: 100, estimatedCostUSD: 0.001 }));
    tracker.record(makeEvent({ totalTokens: 200, estimatedCostUSD: 0.002 }));
    const s = tracker.getSummary();
    expect(s.totalTokens).toBe(300);
    expect(s.estimatedCostUSD).toBeCloseTo(0.003);
  });

  it('getSummary() aggregates by provider', () => {
    tracker.record(makeEvent({ provider: 'gemini', totalTokens: 100 }));
    tracker.record(makeEvent({ provider: 'tavily', totalTokens: 0 }));
    const s = tracker.getSummary();
    expect(s.byProvider['gemini']?.calls).toBe(1);
    expect(s.byProvider['tavily']?.calls).toBe(1);
  });

  it('getSummary() computes avgLatencyMs by label', () => {
    tracker.record(makeEvent({ label: 'summarize', latencyMs: 100 }));
    tracker.record(makeEvent({ label: 'summarize', latencyMs: 200 }));
    const s = tracker.getSummary();
    expect(s.byLabel['summarize']?.avgLatencyMs).toBe(150);
  });

  it('getSummary() computes error rate', () => {
    tracker.record(makeEvent({ success: true }));
    tracker.record(makeEvent({ success: false }));
    expect(tracker.getSummary().errorRate).toBe(0.5);
  });

  it('getSummary() filters by since date', () => {
    const past = new Date(Date.now() - 10_000);
    tracker.record(makeEvent({ timestamp: past }));
    tracker.record(makeEvent({ timestamp: new Date() }));
    const s = tracker.getSummary(new Date(Date.now() - 5_000));
    expect(s.totalCalls).toBe(1);
  });

  it('flush() writes JSONL file and clears buffer', async () => {
    tracker.record(makeEvent({ label: 'flush-me' }));
    await tracker.flush();
    expect(tracker.getSummary().totalCalls).toBe(0);
    const files = fs.readdirSync(tmpDir);
    expect(files.length).toBe(1);
    const content = fs.readFileSync(path.join(tmpDir, files[0]!), 'utf-8');
    expect(content).toContain('flush-me');
  });

  it('flush() does nothing when buffer is empty', async () => {
    await tracker.flush();
    expect(fs.readdirSync(tmpDir).length).toBe(0);
  });

  it('buffer caps at 1000 events — oldest evicted', () => {
    for (let i = 0; i < 1001; i++) {
      tracker.record(makeEvent({ label: `event-${i}` }));
    }
    expect(tracker.getSummary().totalCalls).toBe(1000);
  });
});
