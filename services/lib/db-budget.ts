import type { ExternalBudgetState } from '@vigil/clients';

/** Minimal Prisma surface needed for budget persistence. */
interface BudgetDB {
  budgetState: {
    findUnique: (args: { where: { id: string } }) => Promise<ExternalBudgetState | null>;
    upsert: (args: {
      where: { id: string };
      update: Omit<ExternalBudgetState, never>;
      create: ExternalBudgetState & { id: string };
    }) => Promise<unknown>;
  };
}

export async function loadBudgetState(db: BudgetDB): Promise<ExternalBudgetState | null> {
  const row = await db.budgetState.findUnique({ where: { id: 'singleton' } });
  if (!row) return null;
  return { monthKey: row.monthKey, monthCount: row.monthCount, dayKey: row.dayKey, dayCount: row.dayCount };
}

export async function saveBudgetState(db: BudgetDB, state: ExternalBudgetState): Promise<void> {
  await db.budgetState.upsert({
    where: { id: 'singleton' },
    update: state,
    create: { id: 'singleton', ...state },
  });
}
