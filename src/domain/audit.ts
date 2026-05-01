type PaidBy = 'cash' | 'card' | 'transfer' | 'personal';
type PaymentMethod = 'cash' | 'card' | 'transfer';

export interface KomandaInput {
  id: string;
  status: string;
  payment_method: PaymentMethod | null;
  total_cents: number | null;
  opened_by_auth_user_id: string;
  items: Array<{ product_category: string; subtotal_cents: number }>;
}

export interface ExpenseInput {
  id: string;
  amount_cents: number;
  paid_by: PaidBy;
  category_id: string | null;
  category_other_label: string | null;
  voided: boolean;
}

export interface CategoryRef { id: string; name: string }

export interface AuditAggregate {
  earnings: {
    total: number;
    byPaymentMethod: Record<PaymentMethod, number>;
    byCategory: Record<string, number>;
    perWaiter: Record<string, { count: number; totalCents: number }>;
  };
  expenses: {
    total: number;
    byPaidBy: Record<PaidBy, number>;
    byCategory: Record<string, number>;
  };
  net: number;
  cashDrawerExpected: number;
}

export function aggregateAudit(input: {
  komandas: KomandaInput[];
  expenses: ExpenseInput[];
  categories: CategoryRef[];
}): AuditAggregate {
  const closed = input.komandas.filter(
    (k) => k.status === 'closed' && k.total_cents != null && k.payment_method,
  );
  const liveExpenses = input.expenses.filter((e) => !e.voided);
  const catName = new Map(input.categories.map((c) => [c.id, c.name] as const));

  const earningsByPM: Record<PaymentMethod, number> = { cash: 0, card: 0, transfer: 0 };
  const earningsByCat: Record<string, number> = {};
  const perWaiter: Record<string, { count: number; totalCents: number }> = {};
  let earningsTotal = 0;

  for (const k of closed) {
    const pm = k.payment_method as PaymentMethod;
    const total = k.total_cents!;
    earningsByPM[pm] += total;
    earningsTotal += total;
    perWaiter[k.opened_by_auth_user_id] ??= { count: 0, totalCents: 0 };
    perWaiter[k.opened_by_auth_user_id].count += 1;
    perWaiter[k.opened_by_auth_user_id].totalCents += total;
    for (const it of k.items) {
      earningsByCat[it.product_category] = (earningsByCat[it.product_category] ?? 0) + it.subtotal_cents;
    }
  }

  const expensesByPaidBy: Record<PaidBy, number> = { cash: 0, card: 0, transfer: 0, personal: 0 };
  const expensesByCat: Record<string, number> = {};
  let expensesTotal = 0;

  for (const e of liveExpenses) {
    expensesByPaidBy[e.paid_by] += e.amount_cents;
    expensesTotal += e.amount_cents;
    const name = e.category_id
      ? catName.get(e.category_id) ?? 'Other'
      : e.category_other_label ?? 'Other';
    expensesByCat[name] = (expensesByCat[name] ?? 0) + e.amount_cents;
  }

  return {
    earnings: {
      total: earningsTotal,
      byPaymentMethod: earningsByPM,
      byCategory: earningsByCat,
      perWaiter,
    },
    expenses: {
      total: expensesTotal,
      byPaidBy: expensesByPaidBy,
      byCategory: expensesByCat,
    },
    net: earningsTotal - expensesTotal,
    cashDrawerExpected: earningsByPM.cash - expensesByPaidBy.cash,
  };
}
