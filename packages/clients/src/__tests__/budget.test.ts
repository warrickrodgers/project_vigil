import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SearchBudget, BudgetExhaustedError } from '../tavily/budget.js';

describe('SearchBudget', () => {
  let tmpDir: string;
  let filePath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vigil-budget-'));
    filePath = path.join(tmpDir, 'budget.json');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.useRealTimers();
  });

  it('fresh budget has full daily/monthly allowance', () => {
    const budget = new SearchBudget({ filePath });
    const result = budget.canSearch();
    expect(result.allowed).toBe(true);
    expect(result.remaining.monthly).toBe(1000);
    expect(result.remaining.daily).toBe(33);
  });

  it('recordSearch() decrements both daily and monthly counters', () => {
    const budget = new SearchBudget({ filePath });
    budget.recordSearch();
    budget.recordSearch();
    const result = budget.canSearch();
    expect(result.remaining.monthly).toBe(998);
    expect(result.remaining.daily).toBe(31);
  });

  it('daily counter resets on new day', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-18T12:00:00.000Z'));
    const b1 = new SearchBudget({ filePath });
    b1.recordSearch();
    expect(b1.getStatus().todayCount).toBe(1);

    vi.setSystemTime(new Date('2026-04-19T00:01:00.000Z'));
    const b2 = new SearchBudget({ filePath });
    expect(b2.getStatus().todayCount).toBe(0);
    expect(b2.getStatus().monthCount).toBe(1); // monthly still accumulates
  });

  it('monthly counter resets on the 1st', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-30T12:00:00.000Z'));
    const b1 = new SearchBudget({ filePath });
    for (let i = 0; i < 50; i++) b1.recordSearch();
    expect(b1.getStatus().monthCount).toBe(50);

    vi.setSystemTime(new Date('2026-05-01T00:01:00.000Z'));
    const b2 = new SearchBudget({ filePath });
    expect(b2.getStatus().monthCount).toBe(0);
    expect(b2.canSearch().remaining.monthly).toBe(1000);
  });

  it('daily soft limit warns but allows', () => {
    const budget = new SearchBudget({ filePath, monthlyLimit: 1000 });
    for (let i = 0; i < 33; i++) budget.recordSearch();
    const result = budget.canSearch();
    expect(result.allowed).toBe(true);
    expect(result.warning).toBeDefined();
  });

  it('monthly hard limit blocks', () => {
    const budget = new SearchBudget({ filePath, monthlyLimit: 5 });
    for (let i = 0; i < 5; i++) budget.recordSearch();
    const result = budget.canSearch();
    expect(result.allowed).toBe(false);
  });

  it('assertCanSearch() throws BudgetExhaustedError at monthly limit', () => {
    const budget = new SearchBudget({ filePath, monthlyLimit: 2 });
    budget.recordSearch();
    budget.recordSearch();
    expect(() => budget.assertCanSearch()).toThrow(BudgetExhaustedError);
  });

  it('persists state to JSON file and survives restart', () => {
    const b1 = new SearchBudget({ filePath });
    b1.recordSearch();
    b1.recordSearch();

    const b2 = new SearchBudget({ filePath });
    expect(b2.getStatus().monthCount).toBe(2);
    expect(b2.canSearch().remaining.monthly).toBe(998);
  });

  it('getStatus() returns correct structure', () => {
    const budget = new SearchBudget({ filePath, monthlyLimit: 100 });
    budget.recordSearch();
    const status = budget.getStatus();
    expect(status.todayCount).toBe(1);
    expect(status.monthCount).toBe(1);
    expect(status.monthlyLimit).toBe(100);
    expect(status.dailySoftLimit).toBe(3);
    expect(status.remaining.monthly).toBe(99);
  });
});
