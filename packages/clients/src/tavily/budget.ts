import fs from 'node:fs';
import path from 'node:path';
import type { BudgetStatus, CanSearchResult } from './types.js';
import { logger } from '../telemetry/logger.js';

/** Shape shared with the Prisma BudgetState model for Lambda persistence. */
export interface ExternalBudgetState {
  monthKey: string; // "2026-04"
  monthCount: number;
  dayKey: string; // "2026-04-23"
  dayCount: number;
}

export class BudgetExhaustedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BudgetExhaustedError';
  }
}

export class SearchBudget {
  private readonly monthlyLimit: number;
  private readonly dailySoftLimit: number;
  private readonly filePath: string;
  private readonly disableFilePersistence: boolean;
  private state: ExternalBudgetState;

  constructor(options?: {
    monthlyLimit?: number;
    filePath?: string;
    /** Pre-loaded state from DB — skips file read when provided (Lambda use-case). */
    initialState?: ExternalBudgetState;
    /** When true, save() is a no-op — caller persists state via getState() (Lambda use-case). */
    disableFilePersistence?: boolean;
  }) {
    this.monthlyLimit = options?.monthlyLimit ?? 1000;
    this.dailySoftLimit = Math.floor(this.monthlyLimit / 30);
    this.filePath = options?.filePath ?? path.join(process.cwd(), 'data', 'tavily-budget.json');
    this.disableFilePersistence = options?.disableFilePersistence ?? false;
    this.state = options?.initialState ?? this.load();
    this.applyResets();
  }

  private todayStr(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private monthStr(): string {
    return new Date().toISOString().slice(0, 7);
  }

  private load(): ExternalBudgetState {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      return JSON.parse(raw) as ExternalBudgetState;
    } catch {
      return { dayCount: 0, monthCount: 0, dayKey: this.todayStr(), monthKey: this.monthStr() };
    }
  }

  private save(): void {
    if (this.disableFilePersistence) return;
    try {
      const dir = path.dirname(this.filePath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(this.state, null, 2), 'utf-8');
    } catch (err) {
      logger.error('Failed to save budget state', err instanceof Error ? err : new Error(String(err)));
    }
  }

  private applyResets(): void {
    const today = this.todayStr();
    const month = this.monthStr();
    let changed = false;

    if (this.state.dayKey !== today) {
      this.state.dayCount = 0;
      this.state.dayKey = today;
      changed = true;
    }

    if (this.state.monthKey !== month) {
      this.state.monthCount = 0;
      this.state.monthKey = month;
      changed = true;
    }

    if (changed) this.save();
  }

  canSearch(): CanSearchResult {
    this.applyResets();
    const remaining = {
      daily: Math.max(0, this.dailySoftLimit - this.state.dayCount),
      monthly: Math.max(0, this.monthlyLimit - this.state.monthCount),
    };

    if (this.state.monthCount >= this.monthlyLimit) {
      return { allowed: false, remaining };
    }

    if (this.state.dayCount >= this.dailySoftLimit) {
      return {
        allowed: true,
        warning: `Daily soft limit (${this.dailySoftLimit}) reached — ${this.state.monthCount}/${this.monthlyLimit} monthly used`,
        remaining,
      };
    }

    return { allowed: true, remaining };
  }

  assertCanSearch(): void {
    const { allowed, remaining } = this.canSearch();
    if (!allowed) {
      throw new BudgetExhaustedError(
        `Monthly Tavily search limit (${this.monthlyLimit}) exhausted. Remaining: ${remaining.monthly}`
      );
    }
  }

  recordSearch(): void {
    this.state.dayCount++;
    this.state.monthCount++;
    this.save();

    const usagePct = this.state.monthCount / this.monthlyLimit;
    if (usagePct >= 0.95) {
      logger.error(
        `Tavily budget critical: ${Math.round(usagePct * 100)}% used (${this.state.monthCount}/${this.monthlyLimit})`,
        undefined,
        { monthCount: this.state.monthCount, monthlyLimit: this.monthlyLimit, usagePct: Math.round(usagePct * 100) },
      );
    } else if (usagePct >= 0.8) {
      logger.warn('Tavily budget warning', {
        monthCount: this.state.monthCount,
        monthlyLimit: this.monthlyLimit,
        usagePct: Math.round(usagePct * 100),
      });
    }
  }

  getStatus(): BudgetStatus {
    this.applyResets();
    return {
      todayCount: this.state.dayCount,
      monthCount: this.state.monthCount,
      dailySoftLimit: this.dailySoftLimit,
      monthlyLimit: this.monthlyLimit,
      remaining: {
        daily: Math.max(0, this.dailySoftLimit - this.state.dayCount),
        monthly: Math.max(0, this.monthlyLimit - this.state.monthCount),
      },
    };
  }

  /** Returns current state for Lambda to persist to DB after the run. */
  getState(): ExternalBudgetState {
    return { ...this.state };
  }
}
