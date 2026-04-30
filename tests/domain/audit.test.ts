import { aggregateAudit } from '@/domain/audit';

const k = (over: Partial<any> = {}) => ({
  id: 'k', status: 'closed', payment_method: 'cash', total_cents: 1000,
  opened_by_auth_user_id: 'u1',
  items: [{ product_category: 'Drinks', subtotal_cents: 1000 }],
  ...over,
});

const e = (over: Partial<any> = {}) => ({
  id: 'e', amount_cents: 200, paid_by: 'cash', category_id: 'c1',
  category_other_label: null, voided: false,
  ...over,
});

describe('aggregateAudit', () => {
  it('sums earnings only from closed komandas, grouped by payment method', () => {
    const r = aggregateAudit({
      komandas: [
        k({ payment_method: 'cash', total_cents: 1000 }),
        k({ payment_method: 'card', total_cents: 500 }),
        k({ status: 'open', total_cents: 999 }),
      ],
      expenses: [],
      categories: [],
    });
    expect(r.earnings.total).toBe(1500);
    expect(r.earnings.byPaymentMethod.cash).toBe(1000);
    expect(r.earnings.byPaymentMethod.card).toBe(500);
    expect(r.earnings.byPaymentMethod.transfer).toBe(0);
  });

  it('groups earnings by product category', () => {
    const r = aggregateAudit({
      komandas: [
        k({ items: [
          { product_category: 'Drinks', subtotal_cents: 800 },
          { product_category: 'Food', subtotal_cents: 200 },
        ]}),
      ],
      expenses: [],
      categories: [],
    });
    expect(r.earnings.byCategory.Drinks).toBe(800);
    expect(r.earnings.byCategory.Food).toBe(200);
  });

  it('groups earnings per waiter', () => {
    const r = aggregateAudit({
      komandas: [
        k({ opened_by_auth_user_id: 'u1', total_cents: 1000 }),
        k({ opened_by_auth_user_id: 'u2', total_cents: 700 }),
      ],
      expenses: [],
      categories: [],
    });
    expect(r.earnings.perWaiter.u1.totalCents).toBe(1000);
    expect(r.earnings.perWaiter.u1.count).toBe(1);
    expect(r.earnings.perWaiter.u2.totalCents).toBe(700);
  });

  it('sums expenses excluding voided, groups by paid_by + category', () => {
    const r = aggregateAudit({
      komandas: [],
      expenses: [
        e({ amount_cents: 200, paid_by: 'cash', category_id: 'c1' }),
        e({ amount_cents: 300, paid_by: 'card', category_id: 'c2' }),
        e({ amount_cents: 999, voided: true }),
      ],
      categories: [
        { id: 'c1', name: 'Produce' },
        { id: 'c2', name: 'Supplies' },
      ],
    });
    expect(r.expenses.total).toBe(500);
    expect(r.expenses.byPaidBy.cash).toBe(200);
    expect(r.expenses.byPaidBy.card).toBe(300);
    expect(r.expenses.byCategory.Produce).toBe(200);
    expect(r.expenses.byCategory.Supplies).toBe(300);
  });

  it('uses category_other_label when category_id is null', () => {
    const r = aggregateAudit({
      komandas: [],
      expenses: [
        e({ amount_cents: 150, paid_by: 'cash', category_id: null, category_other_label: 'Snack' }),
      ],
      categories: [],
    });
    expect(r.expenses.byCategory.Snack).toBe(150);
  });

  it('net = earnings - expenses (including personal)', () => {
    const r = aggregateAudit({
      komandas: [k({ total_cents: 1000 })],
      expenses: [e({ amount_cents: 300, paid_by: 'personal' })],
      categories: [],
    });
    expect(r.net).toBe(700);
  });

  it('cash drawer expected = cash earnings - cash expenses (excludes personal)', () => {
    const r = aggregateAudit({
      komandas: [k({ payment_method: 'cash', total_cents: 1000 })],
      expenses: [
        e({ amount_cents: 200, paid_by: 'cash' }),
        e({ amount_cents: 500, paid_by: 'personal' }),
      ],
      categories: [],
    });
    expect(r.cashDrawerExpected).toBe(800);
  });

  it('handles empty inputs', () => {
    const r = aggregateAudit({ komandas: [], expenses: [], categories: [] });
    expect(r.earnings.total).toBe(0);
    expect(r.expenses.total).toBe(0);
    expect(r.net).toBe(0);
    expect(r.cashDrawerExpected).toBe(0);
  });
});
