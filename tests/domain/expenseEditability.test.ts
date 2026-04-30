import { canEditExpense, EDIT_WINDOW_MS } from '@/domain/expenseEditability';

const baseExpense = {
  created_by_auth_user_id: 'u1',
  created_at: new Date().toISOString(),
  voided: false,
};
const openPeriod = { status: 'open' as const };
const closedPeriod = { status: 'closed' as const };

describe('canEditExpense', () => {
  it('allows creator within window in open period', () => {
    expect(canEditExpense({ expense: baseExpense, period: openPeriod, currentUserId: 'u1', now: Date.now() })).toBe(true);
  });
  it('blocks non-creator', () => {
    expect(canEditExpense({ expense: baseExpense, period: openPeriod, currentUserId: 'u2', now: Date.now() })).toBe(false);
  });
  it('blocks after window', () => {
    const created = Date.now() - EDIT_WINDOW_MS - 1;
    expect(canEditExpense({
      expense: { ...baseExpense, created_at: new Date(created).toISOString() },
      period: openPeriod,
      currentUserId: 'u1',
      now: Date.now(),
    })).toBe(false);
  });
  it('blocks closed period', () => {
    expect(canEditExpense({ expense: baseExpense, period: closedPeriod, currentUserId: 'u1', now: Date.now() })).toBe(false);
  });
  it('blocks voided', () => {
    expect(canEditExpense({
      expense: { ...baseExpense, voided: true },
      period: openPeriod,
      currentUserId: 'u1',
      now: Date.now(),
    })).toBe(false);
  });
});
