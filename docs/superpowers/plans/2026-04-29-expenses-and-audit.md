# Expenses & Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track operational expenses during the operating day and produce a closeable end-of-day audit (earnings, expenses, net profit, cash drawer) with locked snapshots after close.

**Architecture:** New `audit_periods` entity per org with one open at any time. New `expense_categories` (per-org CRUD) and `expenses` tables. Komandas and expenses attach to the current open period at creation. Closing the day flips period status atomically and mints the next one. UI surfaces: bottom-nav "Audit" tab (current period), Settings → Audit history (closed periods), Settings → Expense categories (admin-only).

**Tech Stack:** Expo Router, React Native, TanStack Query, Zod, InsForge SDK, Vitest.

**Spec:** [docs/superpowers/specs/2026-04-29-expenses-and-audit-design.md](../specs/2026-04-29-expenses-and-audit-design.md)
**Depends on:** Roles & Invitations plan (4-role enum + `can.*` helpers).

---

## File map

**Create**
- `db/migrations/2026-04-30-expenses-and-audit.sql`
- `src/insforge/queries/auditPeriods.ts`
- `src/insforge/queries/expenseCategories.ts`
- `src/insforge/queries/expenses.ts`
- `src/insforge/queries/audit.ts` — aggregation queries (earnings, expenses, net, drawer)
- `src/domain/audit.ts` — pure aggregation functions (testable)
- `src/domain/expenseEditability.ts` — pure predicate
- `src/mutations/useCreateExpense.ts`
- `src/mutations/useUpdateExpense.ts`
- `src/mutations/useVoidExpense.ts`
- `src/mutations/useCloseDay.ts`
- `src/mutations/useReopenPeriod.ts`
- `src/mutations/useUpsertExpenseCategory.ts`
- `src/offline/handlers/createExpense.ts`
- `src/features/audit/components/MetricsCards.tsx`
- `src/features/audit/components/CategoryBreakdown.tsx`
- `src/features/audit/components/RecentList.tsx`
- `src/features/audit/components/AddExpenseSheet.tsx`
- `src/features/audit/components/CloseDayConfirm.tsx`
- `app/(app)/audit/_layout.tsx`
- `app/(app)/audit/index.tsx`
- `app/(app)/audit/expenses/index.tsx`
- `app/(app)/audit/expenses/[id].tsx`
- `app/(app)/settings/audit-history/index.tsx`
- `app/(app)/settings/audit-history/[id].tsx`
- `app/(app)/settings/expense-categories.tsx`
- `tests/domain/audit.test.ts`
- `tests/domain/expenseEditability.test.ts`
- `tests/insforge/auditPeriods.integration.test.ts`
- `tests/insforge/expenses.integration.test.ts`

**Modify**
- `src/insforge/schemas.ts` — add audit/expense schemas, extend Komanda with `period_id`
- `src/offline/handlers/index.ts` — register createExpense handler
- `src/offline/handlers/createKomanda.ts` — attach `period_id` at sync time (server-side default suffices; client may pass null)
- `app/(app)/_layout.tsx` — bottom nav: add Audit tab (visible to admin/cashier)
- `app/(app)/settings/index.tsx` — add Audit history + Expense categories rows (admin)

---

## Conventions

Same as Plan 1: TDD, small commits, file paths absolute in code.

- **Currency:** all amounts in `cents` (integer). Reuse existing format helpers in `src/domain/` if present (search `formatCents` / `formatMoney`).
- **Aggregation lives in `src/domain/audit.ts`** as pure functions over plain inputs (rows). Query layer fetches rows; UI passes them to pure fns. This keeps tests fast.
- **Run all tests:** `pnpm test`
- **Run a single test file:** `pnpm test tests/domain/audit.test.ts`

---

## Task 1: Database migration

**Files:**
- Create: `db/migrations/2026-04-30-expenses-and-audit.sql`

- [ ] **Step 1: Migration file**

```sql
-- 2026-04-30: audit periods + expenses

-- 1. audit_periods
CREATE TABLE IF NOT EXISTS audit_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('open','closed')),
  opened_at timestamptz NOT NULL DEFAULT now(),
  opened_by_auth_user_id uuid NOT NULL REFERENCES users(id),
  closed_at timestamptz,
  closed_by_auth_user_id uuid REFERENCES users(id),
  reopened_at timestamptz,
  reopened_by_auth_user_id uuid REFERENCES users(id),
  reopen_reason text
);

-- Exactly one open period per org.
CREATE UNIQUE INDEX IF NOT EXISTS audit_periods_one_open_per_org
  ON audit_periods(org_id) WHERE status = 'open';

-- 2. Backfill: one open period per existing org, attach existing komandas.
INSERT INTO audit_periods (org_id, status, opened_at, opened_by_auth_user_id)
SELECT o.id, 'open', now(), m.auth_user_id
  FROM organizations o
  JOIN LATERAL (
    SELECT auth_user_id FROM organization_members
     WHERE org_id = o.id AND role = 'admin' LIMIT 1
  ) m ON true
 WHERE NOT EXISTS (
   SELECT 1 FROM audit_periods p WHERE p.org_id = o.id AND p.status = 'open'
 );

ALTER TABLE komandas
  ADD COLUMN IF NOT EXISTS period_id uuid REFERENCES audit_periods(id);

UPDATE komandas k
   SET period_id = (
     SELECT id FROM audit_periods p WHERE p.org_id = k.org_id AND p.status = 'open' LIMIT 1
   )
 WHERE period_id IS NULL;

ALTER TABLE komandas ALTER COLUMN period_id SET NOT NULL;

-- 3. expense_categories
CREATE TABLE IF NOT EXISTS expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, name)
);

-- Seed defaults per org.
INSERT INTO expense_categories (org_id, name, sort_order)
SELECT o.id, c.name, c.idx
  FROM organizations o
  CROSS JOIN (VALUES
    ('Produce', 1), ('Supplies', 2), ('Repairs', 3), ('Utilities', 4)
  ) AS c(name, idx)
  ON CONFLICT (org_id, name) DO NOTHING;

-- 4. expenses
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_id uuid NOT NULL REFERENCES audit_periods(id),
  amount_cents int NOT NULL CHECK (amount_cents > 0),
  category_id uuid REFERENCES expense_categories(id),
  category_other_label text,
  note text NOT NULL,
  paid_by text NOT NULL CHECK (paid_by IN ('cash','card','transfer','personal')),
  voided boolean NOT NULL DEFAULT false,
  voided_at timestamptz,
  voided_by_auth_user_id uuid REFERENCES users(id),
  void_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by_auth_user_id uuid NOT NULL REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  local_uuid uuid NOT NULL,
  UNIQUE (org_id, local_uuid),
  CHECK ((category_id IS NOT NULL) OR (category_other_label IS NOT NULL AND length(trim(category_other_label)) > 0))
);
CREATE INDEX IF NOT EXISTS expenses_period_idx ON expenses(period_id);
CREATE INDEX IF NOT EXISTS expenses_org_created_idx ON expenses(org_id, created_at DESC);

-- 5. RLS
ALTER TABLE audit_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_periods_read ON audit_periods FOR SELECT USING (
  org_id IN (SELECT org_id FROM organization_members WHERE auth_user_id = auth.uid())
);
CREATE POLICY audit_periods_write ON audit_periods FOR ALL USING (
  org_id IN (
    SELECT org_id FROM organization_members
     WHERE auth_user_id = auth.uid() AND role IN ('admin','cashier')
  )
) WITH CHECK (
  org_id IN (
    SELECT org_id FROM organization_members
     WHERE auth_user_id = auth.uid() AND role IN ('admin','cashier')
  )
);

CREATE POLICY expense_cat_read ON expense_categories FOR SELECT USING (
  org_id IN (SELECT org_id FROM organization_members WHERE auth_user_id = auth.uid())
);
CREATE POLICY expense_cat_write ON expense_categories FOR ALL USING (
  org_id IN (
    SELECT org_id FROM organization_members
     WHERE auth_user_id = auth.uid() AND role = 'admin'
  )
) WITH CHECK (
  org_id IN (
    SELECT org_id FROM organization_members
     WHERE auth_user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY expenses_read ON expenses FOR SELECT USING (
  org_id IN (
    SELECT org_id FROM organization_members
     WHERE auth_user_id = auth.uid() AND role IN ('admin','cashier')
  )
);
CREATE POLICY expenses_write ON expenses FOR ALL USING (
  org_id IN (
    SELECT org_id FROM organization_members
     WHERE auth_user_id = auth.uid() AND role IN ('admin','cashier')
  )
) WITH CHECK (
  org_id IN (
    SELECT org_id FROM organization_members
     WHERE auth_user_id = auth.uid() AND role IN ('admin','cashier')
  )
);

-- 6. RPCs

-- Close current open period and mint next.
CREATE OR REPLACE FUNCTION close_day(p_org_id uuid)
RETURNS audit_periods
LANGUAGE plpgsql
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_open audit_periods%ROWTYPE;
  v_open_komandas int;
  v_next audit_periods%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM organization_members
     WHERE auth_user_id = v_uid AND org_id = p_org_id AND role IN ('admin','cashier')
  ) THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT * INTO v_open FROM audit_periods WHERE org_id = p_org_id AND status = 'open' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no_open_period'; END IF;

  SELECT count(*) INTO v_open_komandas FROM komandas
    WHERE period_id = v_open.id AND status NOT IN ('closed');
  IF v_open_komandas > 0 THEN RAISE EXCEPTION 'open_komandas:%', v_open_komandas; END IF;

  UPDATE audit_periods
     SET status='closed', closed_at=now(), closed_by_auth_user_id=v_uid
   WHERE id = v_open.id
   RETURNING * INTO v_open;

  INSERT INTO audit_periods (org_id, status, opened_at, opened_by_auth_user_id)
  VALUES (p_org_id, 'open', now(), v_uid)
  RETURNING * INTO v_next;

  RETURN v_open;
END;
$$;

-- Reopen a closed period (admin-only). Requires current open period to be empty.
CREATE OR REPLACE FUNCTION reopen_period(p_period_id uuid, p_reason text)
RETURNS audit_periods
LANGUAGE plpgsql
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_target audit_periods%ROWTYPE;
  v_current audit_periods%ROWTYPE;
  v_activity int;
BEGIN
  SELECT * INTO v_target FROM audit_periods WHERE id = p_period_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'period_not_found'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM organization_members
     WHERE auth_user_id = v_uid AND org_id = v_target.org_id AND role = 'admin'
  ) THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF v_target.status <> 'closed' THEN RAISE EXCEPTION 'period_not_closed'; END IF;

  SELECT * INTO v_current FROM audit_periods
    WHERE org_id = v_target.org_id AND status = 'open' FOR UPDATE;
  IF FOUND THEN
    SELECT count(*) INTO v_activity FROM (
      SELECT 1 FROM komandas WHERE period_id = v_current.id
      UNION ALL
      SELECT 1 FROM expenses WHERE period_id = v_current.id
    ) x;
    IF v_activity > 0 THEN RAISE EXCEPTION 'current_period_not_empty'; END IF;
    DELETE FROM audit_periods WHERE id = v_current.id;
  END IF;

  UPDATE audit_periods
     SET status='open',
         reopened_at=now(),
         reopened_by_auth_user_id=v_uid,
         reopen_reason=p_reason,
         closed_at=null,
         closed_by_auth_user_id=null
   WHERE id = v_target.id
   RETURNING * INTO v_target;

  RETURN v_target;
END;
$$;
```

- [ ] **Step 2: Apply**

Run: `pnpm insforge:migrate db/migrations/2026-04-30-expenses-and-audit.sql`
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add db/migrations/2026-04-30-expenses-and-audit.sql
git commit -m "feat(db): audit periods + expenses + RLS + RPCs"
```

---

## Task 2: Schema additions

**Files:**
- Modify: `src/insforge/schemas.ts`

- [ ] **Step 1: Append schemas**

```ts
export const AuditPeriodStatus = z.enum(['open', 'closed']);
export const AuditPeriodRow = z.object({
  id: uuid,
  org_id: uuid,
  status: AuditPeriodStatus,
  opened_at: iso,
  opened_by_auth_user_id: uuid,
  closed_at: iso.nullable(),
  closed_by_auth_user_id: uuid.nullable(),
  reopened_at: iso.nullable(),
  reopened_by_auth_user_id: uuid.nullable(),
  reopen_reason: z.string().nullable(),
});

export const ExpenseCategoryRow = z.object({
  id: uuid,
  org_id: uuid,
  name: z.string(),
  active: z.boolean(),
  sort_order: z.number().int(),
  created_at: iso,
});

export const ExpensePaidBy = z.enum(['cash', 'card', 'transfer', 'personal']);
export const ExpenseRow = z.object({
  id: uuid,
  org_id: uuid,
  period_id: uuid,
  amount_cents: z.number().int().positive(),
  category_id: uuid.nullable(),
  category_other_label: z.string().nullable(),
  note: z.string(),
  paid_by: ExpensePaidBy,
  voided: z.boolean(),
  voided_at: iso.nullable(),
  voided_by_auth_user_id: uuid.nullable(),
  void_reason: z.string().nullable(),
  created_at: iso,
  created_by_auth_user_id: uuid,
  updated_at: iso,
  local_uuid: uuid,
});

export type AuditPeriodRowT = z.infer<typeof AuditPeriodRow>;
export type ExpenseCategoryRowT = z.infer<typeof ExpenseCategoryRow>;
export type ExpenseRowT = z.infer<typeof ExpenseRow>;
export type ExpensePaidByT = z.infer<typeof ExpensePaidBy>;
```

Also extend `KomandaRow`:

```ts
export const KomandaRow = z.object({
  // ...existing fields...
  period_id: uuid,
});
```

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/insforge/schemas.ts
git commit -m "feat(schemas): audit period + expense + komanda.period_id"
```

---

## Task 3: Pure aggregation domain — `audit.ts`

**Files:**
- Create: `src/domain/audit.ts`
- Create: `tests/domain/audit.test.ts`

- [ ] **Step 1: Tests**

```ts
import { describe, expect, it } from 'vitest';
import { aggregateAudit } from '@/domain/audit';

const k = (over: any = {}) => ({
  id: 'k', status: 'closed', payment_method: 'cash', total_cents: 1000,
  opened_by_auth_user_id: 'u1', items: [{ product_category: 'Drinks', subtotal_cents: 1000 }],
  ...over,
});

const e = (over: any = {}) => ({
  id: 'e', amount_cents: 200, paid_by: 'cash', category_id: 'c1', category_other_label: null,
  voided: false, ...over,
});

describe('aggregateAudit', () => {
  it('sums earnings only from closed komandas, grouped by payment method', () => {
    const r = aggregateAudit({
      komandas: [k({ payment_method: 'cash', total_cents: 1000 }),
                 k({ payment_method: 'card', total_cents: 500 }),
                 k({ status: 'open', total_cents: 999 })],
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
        k({ items: [{ product_category: 'Drinks', subtotal_cents: 800 }, { product_category: 'Food', subtotal_cents: 200 }] }),
      ],
      expenses: [], categories: [],
    });
    expect(r.earnings.byCategory.Drinks).toBe(800);
    expect(r.earnings.byCategory.Food).toBe(200);
  });

  it('groups earnings per waiter', () => {
    const r = aggregateAudit({
      komandas: [k({ opened_by_auth_user_id: 'u1', total_cents: 1000 }),
                 k({ opened_by_auth_user_id: 'u2', total_cents: 700 })],
      expenses: [], categories: [],
    });
    expect(r.earnings.perWaiter['u1'].totalCents).toBe(1000);
    expect(r.earnings.perWaiter['u1'].count).toBe(1);
    expect(r.earnings.perWaiter['u2'].totalCents).toBe(700);
  });

  it('sums expenses excluding voided, groups by paid_by + category', () => {
    const r = aggregateAudit({
      komandas: [],
      expenses: [
        e({ amount_cents: 200, paid_by: 'cash', category_id: 'c1' }),
        e({ amount_cents: 300, paid_by: 'card', category_id: 'c2' }),
        e({ amount_cents: 999, voided: true }),
      ],
      categories: [{ id: 'c1', name: 'Produce' }, { id: 'c2', name: 'Supplies' }] as any,
    });
    expect(r.expenses.total).toBe(500);
    expect(r.expenses.byPaidBy.cash).toBe(200);
    expect(r.expenses.byPaidBy.card).toBe(300);
    expect(r.expenses.byCategory.Produce).toBe(200);
    expect(r.expenses.byCategory.Supplies).toBe(300);
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
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `pnpm test tests/domain/audit.test.ts`
Expected: module not found.

- [ ] **Step 3: Implement**

```ts
// src/domain/audit.ts

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

export interface CategoryRef {
  id: string;
  name: string;
}

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
  const closed = input.komandas.filter((k) => k.status === 'closed' && k.total_cents != null && k.payment_method);
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
    const name = e.category_id ? (catName.get(e.category_id) ?? 'Other') : (e.category_other_label ?? 'Other');
    expensesByCat[name] = (expensesByCat[name] ?? 0) + e.amount_cents;
  }

  const cashDrawerExpected = earningsByPM.cash - expensesByPaidBy.cash;

  return {
    earnings: { total: earningsTotal, byPaymentMethod: earningsByPM, byCategory: earningsByCat, perWaiter },
    expenses: { total: expensesTotal, byPaidBy: expensesByPaidBy, byCategory: expensesByCat },
    net: earningsTotal - expensesTotal,
    cashDrawerExpected,
  };
}
```

- [ ] **Step 4: Run, expect PASS**

Run: `pnpm test tests/domain/audit.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/audit.ts tests/domain/audit.test.ts
git commit -m "feat(domain): pure aggregateAudit with full coverage"
```

---

## Task 4: Pure expense editability predicate

**Files:**
- Create: `src/domain/expenseEditability.ts`
- Create: `tests/domain/expenseEditability.test.ts`

- [ ] **Step 1: Tests**

```ts
import { describe, expect, it } from 'vitest';
import { canEditExpense, EDIT_WINDOW_MS } from '@/domain/expenseEditability';

const baseExpense = {
  id: 'e1', created_by_auth_user_id: 'u1', created_at: new Date().toISOString(), voided: false,
};
const openPeriod = { id: 'p1', status: 'open' as const };
const closedPeriod = { id: 'p1', status: 'closed' as const };

describe('canEditExpense', () => {
  it('allows creator within window in open period', () => {
    expect(canEditExpense({ expense: baseExpense, period: openPeriod, currentUserId: 'u1', now: Date.now() })).toBe(true);
  });
  it('blocks non-creator', () => {
    expect(canEditExpense({ expense: baseExpense, period: openPeriod, currentUserId: 'u2', now: Date.now() })).toBe(false);
  });
  it('blocks after window', () => {
    const created = Date.now() - EDIT_WINDOW_MS - 1;
    expect(canEditExpense({ expense: { ...baseExpense, created_at: new Date(created).toISOString() }, period: openPeriod, currentUserId: 'u1', now: Date.now() })).toBe(false);
  });
  it('blocks closed period', () => {
    expect(canEditExpense({ expense: baseExpense, period: closedPeriod, currentUserId: 'u1', now: Date.now() })).toBe(false);
  });
  it('blocks voided', () => {
    expect(canEditExpense({ expense: { ...baseExpense, voided: true }, period: openPeriod, currentUserId: 'u1', now: Date.now() })).toBe(false);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `pnpm test tests/domain/expenseEditability.test.ts`

- [ ] **Step 3: Implement**

```ts
export const EDIT_WINDOW_MS = 15 * 60 * 1000;

export function canEditExpense(args: {
  expense: { created_by_auth_user_id: string; created_at: string; voided: boolean };
  period: { status: 'open' | 'closed' };
  currentUserId: string;
  now: number;
}): boolean {
  if (args.expense.voided) return false;
  if (args.period.status !== 'open') return false;
  if (args.expense.created_by_auth_user_id !== args.currentUserId) return false;
  const age = args.now - new Date(args.expense.created_at).getTime();
  return age < EDIT_WINDOW_MS;
}
```

- [ ] **Step 4: Run, expect PASS**

Run: `pnpm test tests/domain/expenseEditability.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/domain/expenseEditability.ts tests/domain/expenseEditability.test.ts
git commit -m "feat(domain): canEditExpense predicate"
```

---

## Task 5: Audit period queries

**Files:**
- Create: `src/insforge/queries/auditPeriods.ts`

- [ ] **Step 1: Implement**

```ts
import { z } from 'zod';
import { insforge } from '@/insforge/client';
import { AuditPeriodRow, type AuditPeriodRowT } from '@/insforge/schemas';

const List = z.array(AuditPeriodRow);

export async function fetchOpenPeriod(orgId: string): Promise<AuditPeriodRowT> {
  const { data, error } = await insforge.database
    .from('audit_periods')
    .select('*')
    .eq('org_id', orgId)
    .eq('status', 'open')
    .single();
  if (error) throw error;
  return AuditPeriodRow.parse(data);
}

export async function fetchPeriod(id: string): Promise<AuditPeriodRowT> {
  const { data, error } = await insforge.database
    .from('audit_periods')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return AuditPeriodRow.parse(data);
}

export async function listClosedPeriods(orgId: string): Promise<AuditPeriodRowT[]> {
  const { data, error } = await insforge.database
    .from('audit_periods')
    .select('*')
    .eq('org_id', orgId)
    .eq('status', 'closed')
    .order('closed_at', { ascending: false });
  if (error) throw error;
  return List.parse(data ?? []);
}

export async function closeDay(orgId: string): Promise<AuditPeriodRowT> {
  const { data, error } = await insforge.database.rpc('close_day', { p_org_id: orgId });
  if (error) throw error;
  return AuditPeriodRow.parse(data);
}

export async function reopenPeriod(periodId: string, reason: string): Promise<AuditPeriodRowT> {
  const { data, error } = await insforge.database.rpc('reopen_period', {
    p_period_id: periodId, p_reason: reason,
  });
  if (error) throw error;
  return AuditPeriodRow.parse(data);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/insforge/queries/auditPeriods.ts
git commit -m "feat(audit): period queries + RPC wrappers"
```

---

## Task 6: Expense category queries

**Files:**
- Create: `src/insforge/queries/expenseCategories.ts`

- [ ] **Step 1: Implement**

```ts
import { z } from 'zod';
import { insforge } from '@/insforge/client';
import { ExpenseCategoryRow, type ExpenseCategoryRowT } from '@/insforge/schemas';

const List = z.array(ExpenseCategoryRow);

export async function listExpenseCategories(orgId: string, opts: { activeOnly?: boolean } = {}): Promise<ExpenseCategoryRowT[]> {
  let q = insforge.database.from('expense_categories').select('*').eq('org_id', orgId).order('sort_order', { ascending: true });
  if (opts.activeOnly) q = q.eq('active', true);
  const { data, error } = await q;
  if (error) throw error;
  return List.parse(data ?? []);
}

export async function upsertExpenseCategory(input: {
  id?: string; orgId: string; name: string; active?: boolean; sort_order?: number;
}): Promise<ExpenseCategoryRowT> {
  const row = {
    id: input.id,
    org_id: input.orgId,
    name: input.name,
    active: input.active ?? true,
    sort_order: input.sort_order ?? 0,
  };
  const { data, error } = await insforge.database
    .from('expense_categories')
    .upsert(row)
    .select('*')
    .single();
  if (error) throw error;
  return ExpenseCategoryRow.parse(data);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/insforge/queries/expenseCategories.ts
git commit -m "feat(audit): expense category queries"
```

---

## Task 7: Expense queries

**Files:**
- Create: `src/insforge/queries/expenses.ts`

- [ ] **Step 1: Implement**

```ts
import { z } from 'zod';
import { insforge } from '@/insforge/client';
import { ExpenseRow, type ExpenseRowT } from '@/insforge/schemas';

const List = z.array(ExpenseRow);

export async function listExpensesForPeriod(periodId: string): Promise<ExpenseRowT[]> {
  const { data, error } = await insforge.database
    .from('expenses')
    .select('*')
    .eq('period_id', periodId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return List.parse(data ?? []);
}

export async function fetchExpense(id: string): Promise<ExpenseRowT> {
  const { data, error } = await insforge.database
    .from('expenses')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return ExpenseRow.parse(data);
}

export async function insertExpense(input: {
  org_id: string;
  period_id: string;
  amount_cents: number;
  category_id: string | null;
  category_other_label: string | null;
  note: string;
  paid_by: 'cash' | 'card' | 'transfer' | 'personal';
  local_uuid: string;
  created_by_auth_user_id: string;
}): Promise<ExpenseRowT> {
  const { data, error } = await insforge.database
    .from('expenses')
    .insert(input)
    .select('*')
    .single();
  if (error) throw error;
  return ExpenseRow.parse(data);
}

export async function updateExpense(id: string, patch: Partial<{
  amount_cents: number; category_id: string | null; category_other_label: string | null;
  note: string; paid_by: 'cash' | 'card' | 'transfer' | 'personal';
}>): Promise<ExpenseRowT> {
  const { data, error } = await insforge.database
    .from('expenses')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return ExpenseRow.parse(data);
}

export async function voidExpense(id: string, reason: string, byUserId: string): Promise<ExpenseRowT> {
  const { data, error } = await insforge.database
    .from('expenses')
    .update({ voided: true, voided_at: new Date().toISOString(), void_reason: reason, voided_by_auth_user_id: byUserId })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return ExpenseRow.parse(data);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/insforge/queries/expenses.ts
git commit -m "feat(audit): expense queries"
```

---

## Task 8: Audit aggregate query (joins)

**Files:**
- Create: `src/insforge/queries/audit.ts`

- [ ] **Step 1: Implement**

```ts
import { insforge } from '@/insforge/client';
import { aggregateAudit, type AuditAggregate } from '@/domain/audit';

export async function fetchAuditAggregate(periodId: string): Promise<AuditAggregate> {
  const [{ data: kData, error: kErr }, { data: eData, error: eErr }, { data: cData, error: cErr }] = await Promise.all([
    insforge.database
      .from('komandas')
      .select('id, status, payment_method, total_cents, opened_by_auth_user_id, items:komanda_items(subtotal_cents, products(category))')
      .eq('period_id', periodId),
    insforge.database
      .from('expenses')
      .select('id, amount_cents, paid_by, category_id, category_other_label, voided')
      .eq('period_id', periodId),
    insforge.database.from('expense_categories').select('id, name'),
  ]);
  if (kErr) throw kErr;
  if (eErr) throw eErr;
  if (cErr) throw cErr;

  const komandas = (kData ?? []).map((k: any) => ({
    id: k.id,
    status: k.status,
    payment_method: k.payment_method,
    total_cents: k.total_cents,
    opened_by_auth_user_id: k.opened_by_auth_user_id,
    items: (k.items ?? []).map((it: any) => ({
      product_category: it.products?.category ?? 'Other',
      subtotal_cents: it.subtotal_cents,
    })),
  }));

  return aggregateAudit({ komandas, expenses: (eData ?? []) as any, categories: (cData ?? []) as any });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/insforge/queries/audit.ts
git commit -m "feat(audit): fetchAuditAggregate joining komandas+expenses+categories"
```

---

## Task 9: Offline handler — createExpense

**Files:**
- Create: `src/offline/handlers/createExpense.ts`
- Modify: `src/offline/handlers/index.ts`

- [ ] **Step 1: Implement handler**

```ts
import { fetchOpenPeriod } from '@/insforge/queries/auditPeriods';
import { insertExpense } from '@/insforge/queries/expenses';
import type { ExpensePaidByT } from '@/insforge/schemas';

export type CreateExpensePayload = {
  org_id: string;
  local_uuid: string;
  amount_cents: number;
  category_id: string | null;
  category_other_label: string | null;
  note: string;
  paid_by: ExpensePaidByT;
  created_by_auth_user_id: string;
};

export async function handleCreateExpense(payload: CreateExpensePayload) {
  const period = await fetchOpenPeriod(payload.org_id);
  return insertExpense({
    org_id: payload.org_id,
    period_id: period.id,
    amount_cents: payload.amount_cents,
    category_id: payload.category_id,
    category_other_label: payload.category_other_label,
    note: payload.note,
    paid_by: payload.paid_by,
    local_uuid: payload.local_uuid,
    created_by_auth_user_id: payload.created_by_auth_user_id,
  });
}
```

- [ ] **Step 2: Register in handlers index**

In `src/offline/handlers/index.ts`, add to the dispatch map:

```ts
import { handleCreateExpense } from './createExpense';

// inside the existing map/switch
'create_expense': handleCreateExpense,
```

(Match existing registration style.)

- [ ] **Step 3: Commit**

```bash
git add src/offline/handlers/createExpense.ts src/offline/handlers/index.ts
git commit -m "feat(offline): create_expense handler"
```

---

## Task 10: Mutation hooks for expenses

**Files:**
- Create: `src/mutations/useCreateExpense.ts`
- Create: `src/mutations/useUpdateExpense.ts`
- Create: `src/mutations/useVoidExpense.ts`

- [ ] **Step 1: useCreateExpense**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueue } from '@/offline/queue';
import { queueStore } from '@/offline/handlers';
import { useSession } from '@/insforge/session';
import { uuidv4 } from '@/lib/uuid';
import type { ExpensePaidByT, ExpenseRowT } from '@/insforge/schemas';

export function useCreateExpense(orgId: string, periodId: string) {
  const qc = useQueryClient();
  const session = useSession();
  return useMutation({
    mutationFn: async (input: {
      amount_cents: number; category_id: string | null; category_other_label: string | null;
      note: string; paid_by: ExpensePaidByT;
    }) => {
      if (session.status !== 'signed-in') throw new Error('not_signed_in');
      const local_uuid = uuidv4();
      const optimistic: ExpenseRowT = {
        id: local_uuid,
        org_id: orgId,
        period_id: periodId,
        amount_cents: input.amount_cents,
        category_id: input.category_id,
        category_other_label: input.category_other_label,
        note: input.note,
        paid_by: input.paid_by,
        voided: false, voided_at: null, voided_by_auth_user_id: null, void_reason: null,
        created_at: new Date().toISOString(),
        created_by_auth_user_id: session.session.userId,
        updated_at: new Date().toISOString(),
        local_uuid,
      };

      qc.setQueryData<ExpenseRowT[]>(['expenses', periodId], (prev) => [optimistic, ...(prev ?? [])]);

      await enqueue(queueStore, {
        type: 'create_expense',
        payload: {
          org_id: orgId,
          local_uuid,
          amount_cents: input.amount_cents,
          category_id: input.category_id,
          category_other_label: input.category_other_label,
          note: input.note,
          paid_by: input.paid_by,
          created_by_auth_user_id: session.session.userId,
        },
      });

      return optimistic;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit', periodId] });
    },
  });
}
```

- [ ] **Step 2: useUpdateExpense**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateExpense } from '@/insforge/queries/expenses';
import type { ExpensePaidByT } from '@/insforge/schemas';

export function useUpdateExpense(periodId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; patch: Partial<{ amount_cents: number; category_id: string | null; category_other_label: string | null; note: string; paid_by: ExpensePaidByT }> }) =>
      updateExpense(input.id, input.patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses', periodId] });
      qc.invalidateQueries({ queryKey: ['audit', periodId] });
    },
  });
}
```

- [ ] **Step 3: useVoidExpense**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { voidExpense } from '@/insforge/queries/expenses';
import { useSession } from '@/insforge/session';

export function useVoidExpense(periodId: string) {
  const qc = useQueryClient();
  const session = useSession();
  return useMutation({
    mutationFn: (input: { id: string; reason: string }) => {
      if (session.status !== 'signed-in') throw new Error('not_signed_in');
      return voidExpense(input.id, input.reason, session.session.userId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses', periodId] });
      qc.invalidateQueries({ queryKey: ['audit', periodId] });
    },
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add src/mutations/useCreateExpense.ts src/mutations/useUpdateExpense.ts src/mutations/useVoidExpense.ts
git commit -m "feat(mutations): expense create/update/void"
```

---

## Task 11: Mutation hooks for periods + categories

**Files:**
- Create: `src/mutations/useCloseDay.ts`
- Create: `src/mutations/useReopenPeriod.ts`
- Create: `src/mutations/useUpsertExpenseCategory.ts`

- [ ] **Step 1: useCloseDay**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { closeDay } from '@/insforge/queries/auditPeriods';

export function useCloseDay(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => closeDay(orgId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit-period', orgId] });
      qc.invalidateQueries({ queryKey: ['audit-history', orgId] });
    },
  });
}
```

- [ ] **Step 2: useReopenPeriod**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reopenPeriod } from '@/insforge/queries/auditPeriods';

export function useReopenPeriod(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { periodId: string; reason: string }) => reopenPeriod(input.periodId, input.reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit-period', orgId] });
      qc.invalidateQueries({ queryKey: ['audit-history', orgId] });
    },
  });
}
```

- [ ] **Step 3: useUpsertExpenseCategory**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { upsertExpenseCategory } from '@/insforge/queries/expenseCategories';

export function useUpsertExpenseCategory(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id?: string; name: string; active?: boolean; sort_order?: number }) =>
      upsertExpenseCategory({ ...input, orgId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expense-categories', orgId] });
    },
  });
}
```

- [ ] **Step 4: Commit**

```bash
git add src/mutations/useCloseDay.ts src/mutations/useReopenPeriod.ts src/mutations/useUpsertExpenseCategory.ts
git commit -m "feat(mutations): close day, reopen period, upsert category"
```

---

## Task 12: Audit metrics components

**Files:**
- Create: `src/features/audit/components/MetricsCards.tsx`
- Create: `src/features/audit/components/CategoryBreakdown.tsx`
- Create: `src/features/audit/components/RecentList.tsx`

- [ ] **Step 1: MetricsCards**

```tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Card, Text } from '@/components/ui';
import { color, space } from '@/theme/tokens';
import type { AuditAggregate } from '@/domain/audit';

function money(cents: number) { return `$${(cents / 100).toFixed(2)}`; }

export function MetricsCards({ data }: { data: AuditAggregate }) {
  const netNeg = data.net < 0;
  return (
    <View style={{ gap: space.md }}>
      <Card padded>
        <Text variant="caption">Net profit</Text>
        <Text variant="h1" style={{ color: netNeg ? color.danger : color.textPrimary, marginTop: space.xs }}>
          {money(data.net)}
        </Text>
      </Card>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <Card padded style={{ flex: 1 }}>
          <Text variant="caption">Earnings</Text>
          <Text variant="h2">{money(data.earnings.total)}</Text>
          <View style={{ marginTop: space.sm, gap: 2 }}>
            <Text variant="bodySm">Cash {money(data.earnings.byPaymentMethod.cash)}</Text>
            <Text variant="bodySm">Card {money(data.earnings.byPaymentMethod.card)}</Text>
            <Text variant="bodySm">Transfer {money(data.earnings.byPaymentMethod.transfer)}</Text>
          </View>
        </Card>
        <Card padded style={{ flex: 1 }}>
          <Text variant="caption">Expenses</Text>
          <Text variant="h2">{money(data.expenses.total)}</Text>
          <View style={{ marginTop: space.sm, gap: 2 }}>
            <Text variant="bodySm">Cash {money(data.expenses.byPaidBy.cash)}</Text>
            <Text variant="bodySm">Card {money(data.expenses.byPaidBy.card)}</Text>
            <Text variant="bodySm">Personal {money(data.expenses.byPaidBy.personal)}</Text>
          </View>
        </Card>
      </View>
      <Card padded>
        <Text variant="caption">Cash drawer expected</Text>
        <Text variant="h2">{money(data.cashDrawerExpected)}</Text>
        <Text variant="footnote" style={{ marginTop: space.xs }}>
          (cash earnings − cash expenses; personal excluded)
        </Text>
      </Card>
    </View>
  );
}
```

- [ ] **Step 2: CategoryBreakdown**

```tsx
import React from 'react';
import { View } from 'react-native';
import { Card, Text } from '@/components/ui';
import { space } from '@/theme/tokens';

export function CategoryBreakdown({ title, byCategory }: { title: string; byCategory: Record<string, number> }) {
  const entries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="label">{title}</Text>
      <Card padded>
        {entries.length === 0 ? (
          <Text variant="bodySm">Nothing yet.</Text>
        ) : entries.map(([name, cents]) => (
          <View key={name} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
            <Text variant="body">{name}</Text>
            <Text variant="bodyStrong">{`$${(cents / 100).toFixed(2)}`}</Text>
          </View>
        ))}
      </Card>
    </View>
  );
}
```

- [ ] **Step 3: RecentList (generic)**

```tsx
import React from 'react';
import { Pressable, View } from 'react-native';
import { Card, Text } from '@/components/ui';
import { color, space } from '@/theme/tokens';

export function RecentList<T extends { id: string }>(props: {
  title: string;
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  onSeeAll?: () => void;
}) {
  const shown = props.items.slice(0, 5);
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="label">{props.title}</Text>
        {props.onSeeAll ? (
          <Pressable onPress={props.onSeeAll} hitSlop={8}>
            <Text variant="bodySm" style={{ color: color.primary }}>View all</Text>
          </Pressable>
        ) : null}
      </View>
      <Card padded={false}>
        {shown.length === 0 ? (
          <View style={{ padding: space.lg }}><Text variant="bodySm">Nothing yet.</Text></View>
        ) : shown.map((it, i) => (
          <View key={it.id} style={{ paddingHorizontal: space.lg, paddingVertical: space.md, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: color.border }}>
            {props.renderItem(it)}
          </View>
        ))}
      </Card>
    </View>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/features/audit/components
git commit -m "feat(audit): metrics, category breakdown, recent list components"
```

---

## Task 13: Add-expense bottom sheet

**Files:**
- Create: `src/features/audit/components/AddExpenseSheet.tsx`

- [ ] **Step 1: Implement**

```tsx
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Button, Text } from '@/components/ui';
import { color, radius, space } from '@/theme/tokens';
import { listExpenseCategories } from '@/insforge/queries/expenseCategories';
import { useCreateExpense } from '@/mutations/useCreateExpense';
import type { ExpensePaidByT } from '@/insforge/schemas';

const PAID_BY: ExpensePaidByT[] = ['cash', 'card', 'transfer', 'personal'];

export function AddExpenseSheet({ orgId, periodId, onClose }: { orgId: string; periodId: string; onClose: () => void }) {
  const cats = useQuery({
    queryKey: ['expense-categories', orgId, 'active'],
    queryFn: () => listExpenseCategories(orgId, { activeOnly: true }),
  });
  const create = useCreateExpense(orgId, periodId);

  const [amountStr, setAmountStr] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [otherLabel, setOtherLabel] = useState('');
  const [paidBy, setPaidBy] = useState<ExpensePaidByT>('cash');
  const [note, setNote] = useState('');

  const isOther = categoryId === null;

  function submit() {
    const amount = Math.round(parseFloat(amountStr.replace(',', '.')) * 100);
    if (!Number.isFinite(amount) || amount <= 0) { Alert.alert('Enter a valid amount'); return; }
    if (!note.trim()) { Alert.alert('Justification required'); return; }
    if (isOther && !otherLabel.trim()) { Alert.alert('Describe the category'); return; }

    create.mutate({
      amount_cents: amount,
      category_id: isOther ? null : categoryId,
      category_other_label: isOther ? otherLabel.trim() : null,
      note: note.trim(),
      paid_by: paidBy,
    }, {
      onSuccess: () => onClose(),
      onError: (e) => Alert.alert('Could not save', String((e as Error).message)),
    });
  }

  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text variant="h2" align="center">New expense</Text>

        <View style={{ gap: space.sm, marginTop: space.lg }}>
          <Text variant="caption">Amount</Text>
          <TextInput value={amountStr} onChangeText={setAmountStr} keyboardType="decimal-pad" placeholder="0.00" style={styles.input} />
        </View>

        <View style={{ gap: space.sm, marginTop: space.md }}>
          <Text variant="caption">Category</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(cats.data ?? []).map((c) => (
              <Pressable key={c.id} onPress={() => { setCategoryId(c.id); setOtherLabel(''); }} style={[styles.chip, categoryId === c.id && styles.chipActive]}>
                <Text variant="bodySm" style={{ color: categoryId === c.id ? color.primaryOn : color.textPrimary }}>{c.name}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setCategoryId(null)} style={[styles.chip, isOther && styles.chipActive]}>
              <Text variant="bodySm" style={{ color: isOther ? color.primaryOn : color.textPrimary }}>Other</Text>
            </Pressable>
          </View>
          {isOther ? (
            <TextInput value={otherLabel} onChangeText={setOtherLabel} placeholder="Describe…" style={styles.input} />
          ) : null}
        </View>

        <View style={{ gap: space.sm, marginTop: space.md }}>
          <Text variant="caption">Paid by</Text>
          <View style={styles.segment}>
            {PAID_BY.map((p) => (
              <Pressable key={p} onPress={() => setPaidBy(p)} style={[styles.segmentItem, paidBy === p && styles.segmentActive]}>
                <Text variant="bodyStrong" style={{ textTransform: 'capitalize', color: paidBy === p ? color.primaryOn : color.textPrimary }}>{p}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={{ gap: space.sm, marginTop: space.md }}>
          <Text variant="caption">Note (justification)</Text>
          <TextInput value={note} onChangeText={setNote} multiline numberOfLines={3} style={[styles.input, { height: 88, textAlignVertical: 'top' }]} />
        </View>

        <Button label={create.isPending ? 'Saving…' : 'Save'} onPress={submit} disabled={create.isPending} style={{ marginTop: space.lg }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0006', justifyContent: 'flex-end' },
  sheet: { backgroundColor: color.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: space.lg, paddingBottom: space.xxl },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: color.border, alignSelf: 'center', marginBottom: space.sm },
  input: { borderWidth: 1, borderColor: color.border, borderRadius: radius.md, padding: space.sm, color: color.textPrimary, fontSize: 16 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: color.surfaceAlt },
  chipActive: { backgroundColor: color.primary },
  segment: { flexDirection: 'row', backgroundColor: color.surfaceAlt, borderRadius: radius.full, padding: 4 },
  segmentItem: { flex: 1, paddingVertical: space.sm, alignItems: 'center', borderRadius: radius.full },
  segmentActive: { backgroundColor: color.primary },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/features/audit/components/AddExpenseSheet.tsx
git commit -m "feat(audit): AddExpenseSheet"
```

---

## Task 14: Close-day confirmation

**Files:**
- Create: `src/features/audit/components/CloseDayConfirm.tsx`

- [ ] **Step 1: Implement**

```tsx
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Text } from '@/components/ui';
import { color, space } from '@/theme/tokens';
import type { AuditAggregate } from '@/domain/audit';

function money(c: number) { return `$${(c / 100).toFixed(2)}`; }

export function CloseDayConfirm(props: {
  data: AuditAggregate;
  openKomandasCount: number;
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  const blocked = props.openKomandasCount > 0;
  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={props.onCancel} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text variant="h2" align="center">{blocked ? 'Cannot close yet' : 'Close day?'}</Text>
        {blocked ? (
          <Text variant="body" align="center" style={{ marginTop: space.md }}>
            {props.openKomandasCount} open komandas. Close them first.
          </Text>
        ) : (
          <>
            <View style={{ marginTop: space.lg, gap: 4 }}>
              <Row label="Earnings" value={money(props.data.earnings.total)} />
              <Row label="Expenses" value={money(props.data.expenses.total)} />
              <Row label="Net" value={money(props.data.net)} bold />
              <Row label="Cash drawer expected" value={money(props.data.cashDrawerExpected)} />
            </View>
            <Button label={props.pending ? 'Closing…' : 'Confirm close day'} onPress={props.onConfirm} disabled={props.pending} style={{ marginTop: space.lg }} />
          </>
        )}
      </View>
    </View>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
      <Text variant={bold ? 'bodyStrong' : 'body'}>{label}</Text>
      <Text variant={bold ? 'bodyStrong' : 'body'}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0006', justifyContent: 'flex-end' },
  sheet: { backgroundColor: color.surface, borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: space.lg, paddingBottom: space.xxl },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: color.border, alignSelf: 'center', marginBottom: space.sm },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/features/audit/components/CloseDayConfirm.tsx
git commit -m "feat(audit): CloseDayConfirm sheet"
```

---

## Task 15: Audit tab — current period screen

**Files:**
- Create: `app/(app)/audit/_layout.tsx`
- Create: `app/(app)/audit/index.tsx`

- [ ] **Step 1: Layout**

```tsx
import { Stack } from 'expo-router';
export default function AuditLayout() { return <Stack screenOptions={{ headerShown: false }} />; }
```

- [ ] **Step 2: Index screen**

```tsx
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Button, Card, Screen, ScreenHeader, Text } from '@/components/ui';
import { color, radius, space } from '@/theme/tokens';
import { fetchMyMembership } from '@/insforge/queries/membership';
import { fetchOpenPeriod } from '@/insforge/queries/auditPeriods';
import { fetchAuditAggregate } from '@/insforge/queries/audit';
import { listExpensesForPeriod } from '@/insforge/queries/expenses';
import { MetricsCards } from '@/features/audit/components/MetricsCards';
import { CategoryBreakdown } from '@/features/audit/components/CategoryBreakdown';
import { RecentList } from '@/features/audit/components/RecentList';
import { AddExpenseSheet } from '@/features/audit/components/AddExpenseSheet';
import { CloseDayConfirm } from '@/features/audit/components/CloseDayConfirm';
import { useCloseDay } from '@/mutations/useCloseDay';
import { can } from '@/auth/permissions';
import { Redirect } from 'expo-router';
import { insforge } from '@/insforge/client';

function money(c: number) { return `$${(c / 100).toFixed(2)}`; }

export default function AuditScreen() {
  const router = useRouter();
  const { data: me } = useQuery({ queryKey: ['membership'], queryFn: fetchMyMembership });

  if (me && !can.viewAudit(me.role)) return <Redirect href="/(app)/komandas" />;

  const orgId = me?.org_id;
  const period = useQuery({
    queryKey: ['audit-period', orgId],
    queryFn: () => fetchOpenPeriod(orgId!),
    enabled: !!orgId,
  });
  const periodId = period.data?.id;

  const aggregate = useQuery({
    queryKey: ['audit', periodId],
    queryFn: () => fetchAuditAggregate(periodId!),
    enabled: !!periodId,
  });
  const expenses = useQuery({
    queryKey: ['expenses', periodId],
    queryFn: () => listExpensesForPeriod(periodId!),
    enabled: !!periodId,
  });
  const openKomandasCount = useQuery({
    queryKey: ['open-komanda-count', periodId],
    queryFn: async () => {
      const { count, error } = await insforge.database
        .from('komandas')
        .select('id', { count: 'exact', head: true })
        .eq('period_id', periodId!)
        .neq('status', 'closed');
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!periodId,
  });

  const closeDay = useCloseDay(orgId ?? '');

  const [showAdd, setShowAdd] = useState(false);
  const [showClose, setShowClose] = useState(false);

  if (!period.data || !aggregate.data) {
    return <Screen padded><Text variant="body">Loading…</Text></Screen>;
  }

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}>
        <ScreenHeader title="Audit" />
        <View style={styles.chip}>
          <Text variant="bodySm">Open · since {new Date(period.data.opened_at).toLocaleString()}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: 96 }}>
        <Button
          label={openKomandasCount.data ? `Close day (${openKomandasCount.data} open)` : 'Close day'}
          variant="secondary"
          onPress={() => setShowClose(true)}
        />

        <MetricsCards data={aggregate.data} />

        <CategoryBreakdown title="Earnings by category" byCategory={aggregate.data.earnings.byCategory} />
        <CategoryBreakdown title="Expenses by category" byCategory={aggregate.data.expenses.byCategory} />

        <Card padded>
          <Text variant="label">Per-waiter earnings</Text>
          <View style={{ marginTop: space.sm, gap: 4 }}>
            {Object.entries(aggregate.data.earnings.perWaiter).map(([uid, v]) => (
              <View key={uid} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="body">{uid.slice(0, 8)}…</Text>
                <Text variant="body">{v.count} · {money(v.totalCents)}</Text>
              </View>
            ))}
            {Object.keys(aggregate.data.earnings.perWaiter).length === 0 ? <Text variant="bodySm">Nothing yet.</Text> : null}
          </View>
        </Card>

        <RecentList
          title="Recent expenses"
          items={expenses.data ?? []}
          onSeeAll={() => router.push('/(app)/audit/expenses')}
          renderItem={(e) => (
            <Pressable onPress={() => router.push(`/(app)/audit/expenses/${e.id}`)}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="bodyStrong" style={{ textDecorationLine: e.voided ? 'line-through' : 'none' }}>{e.note}</Text>
                <Text variant="bodyStrong">{money(e.amount_cents)}</Text>
              </View>
              <Text variant="caption" style={{ textTransform: 'capitalize' }}>{e.paid_by}</Text>
            </Pressable>
          )}
        />
      </ScrollView>

      <Pressable accessibilityRole="button" accessibilityLabel="Add expense" onPress={() => setShowAdd(true)} style={styles.fab}>
        <Ionicons name="add" size={28} color={color.primaryOn} />
      </Pressable>

      {showAdd && periodId ? <AddExpenseSheet orgId={orgId!} periodId={periodId} onClose={() => setShowAdd(false)} /> : null}
      {showClose ? (
        <CloseDayConfirm
          data={aggregate.data}
          openKomandasCount={openKomandasCount.data ?? 0}
          pending={closeDay.isPending}
          onCancel={() => setShowClose(false)}
          onConfirm={() => {
            closeDay.mutate(undefined, {
              onSuccess: () => { setShowClose(false); router.push('/(app)/settings/audit-history'); },
              onError: (e) => Alert.alert('Could not close', String((e as Error).message)),
            });
          }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chip: { alignSelf: 'flex-start', marginTop: space.xs, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, backgroundColor: color.surfaceAlt },
  fab: {
    position: 'absolute', right: space.lg, bottom: space.lg + 16,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: color.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
});
```

- [ ] **Step 3: Commit**

```bash
git add app/\(app\)/audit
git commit -m "feat(audit): tab screen with metrics + add expense + close day"
```

---

## Task 16: Bottom-nav Audit tab + nav restructure

**Files:**
- Modify: `app/(app)/_layout.tsx`

- [ ] **Step 1: Convert (app) to a Tabs layout**

If the current `(app)/_layout.tsx` uses a Stack only, restructure to use Expo Router Tabs for the bottom navigation. Inspect file first; if Tabs already present, just add the Audit tab. If only Stack, add a Tabs file and move screens.

For the minimal change pattern (assuming existing structure uses a single Stack and the user navigates via in-app components), introduce a Tabs layout at `app/(app)/(tabs)/_layout.tsx` and move `komandas` + `audit` + `settings` into it. (See Expo Router docs.) Defer this restructure if scope creeps; instead, add a header tab/segment row at top of `app/(app)/komandas/index.tsx` that links to `/audit` until the next polish pass.

**Pragmatic minimum for this plan:** add a header link/icon to the Audit tab from the Komandas index for `viewAudit` roles.

In `app/(app)/komandas/index.tsx` header row, add:

```tsx
{me && can.viewAudit(me.role) ? (
  <Pressable onPress={() => router.push('/(app)/audit')} accessibilityLabel="Audit">
    <Ionicons name="stats-chart-outline" size={22} color={color.textPrimary} />
  </Pressable>
) : null}
```

(Mirror existing settings cog button placement.)

- [ ] **Step 2: Commit**

```bash
git add app/\(app\)/komandas/index.tsx
git commit -m "feat(nav): audit entry from komandas header"
```

> Follow-up (out of scope here): formalize bottom Tabs layout once kitchen tab is added.

---

## Task 17: Expenses list + detail

**Files:**
- Create: `app/(app)/audit/expenses/index.tsx`
- Create: `app/(app)/audit/expenses/[id].tsx`

- [ ] **Step 1: List screen**

```tsx
import React from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Card, Screen, ScreenHeader, Text } from '@/components/ui';
import { space } from '@/theme/tokens';
import { fetchMyMembership } from '@/insforge/queries/membership';
import { fetchOpenPeriod } from '@/insforge/queries/auditPeriods';
import { listExpensesForPeriod } from '@/insforge/queries/expenses';

function money(c: number) { return `$${(c / 100).toFixed(2)}`; }

export default function ExpensesList() {
  const router = useRouter();
  const { data: me } = useQuery({ queryKey: ['membership'], queryFn: fetchMyMembership });
  const period = useQuery({ queryKey: ['audit-period', me?.org_id], queryFn: () => fetchOpenPeriod(me!.org_id), enabled: !!me });
  const expenses = useQuery({
    queryKey: ['expenses', period.data?.id],
    queryFn: () => listExpensesForPeriod(period.data!.id),
    enabled: !!period.data,
  });

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}>
        <ScreenHeader showBack title="Expenses" onBack={() => router.back()} />
      </View>
      <FlatList
        data={expenses.data ?? []}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ padding: space.lg, gap: space.sm }}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/(app)/audit/expenses/${item.id}`)}>
            <Card padded>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="bodyStrong" style={{ textDecorationLine: item.voided ? 'line-through' : 'none' }}>{item.note}</Text>
                <Text variant="bodyStrong">{money(item.amount_cents)}</Text>
              </View>
              <Text variant="caption" style={{ textTransform: 'capitalize' }}>{item.paid_by}</Text>
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  );
}
```

- [ ] **Step 2: Detail screen**

```tsx
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Screen, ScreenHeader, Text } from '@/components/ui';
import { color, space } from '@/theme/tokens';
import { fetchExpense } from '@/insforge/queries/expenses';
import { fetchPeriod } from '@/insforge/queries/auditPeriods';
import { fetchMyMembership } from '@/insforge/queries/membership';
import { canEditExpense } from '@/domain/expenseEditability';
import { useVoidExpense } from '@/mutations/useVoidExpense';

function money(c: number) { return `$${(c / 100).toFixed(2)}`; }

export default function ExpenseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: me } = useQuery({ queryKey: ['membership'], queryFn: fetchMyMembership });
  const exp = useQuery({ queryKey: ['expense', id], queryFn: () => fetchExpense(id!), enabled: !!id });
  const period = useQuery({
    queryKey: ['period-for-expense', exp.data?.period_id],
    queryFn: () => fetchPeriod(exp.data!.period_id),
    enabled: !!exp.data,
  });
  const voidM = useVoidExpense(exp.data?.period_id ?? '');
  const [reason, setReason] = useState('');

  if (!exp.data || !me) return <Screen padded><Text variant="body">Loading…</Text></Screen>;

  const editable = period.data ? canEditExpense({
    expense: exp.data, period: { status: period.data.status }, currentUserId: me.auth_user_id, now: Date.now(),
  }) : false;
  const isAdmin = me.role === 'admin';
  const periodOpen = period.data?.status === 'open';
  const canVoid = isAdmin && periodOpen && !exp.data.voided;

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}>
        <ScreenHeader showBack title="Expense" onBack={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md }}>
        <Card padded>
          <Text variant="caption">Amount</Text>
          <Text variant="h1">{money(exp.data.amount_cents)}</Text>
        </Card>
        <Card padded>
          <Text variant="caption">Category</Text>
          <Text variant="body">{exp.data.category_id ?? exp.data.category_other_label ?? '—'}</Text>
          <Text variant="caption" style={{ marginTop: space.sm }}>Paid by</Text>
          <Text variant="body" style={{ textTransform: 'capitalize' }}>{exp.data.paid_by}</Text>
          <Text variant="caption" style={{ marginTop: space.sm }}>Note</Text>
          <Text variant="body">{exp.data.note}</Text>
        </Card>

        {exp.data.voided ? (
          <Card padded><Text variant="bodyStrong" style={{ color: color.danger }}>Voided</Text>{exp.data.void_reason ? <Text variant="bodySm">{exp.data.void_reason}</Text> : null}</Card>
        ) : null}

        {/* Edit form deferred — plan ships read+void only. Follow-up: inline edit form when `editable` is true. */}
        {canVoid ? (
          <Card padded>
            <Text variant="caption">Void reason (required)</Text>
            <Pressable onPress={() => Alert.prompt?.('Void expense', 'Reason:', (text) => {
              if (!text || !text.trim()) return;
              voidM.mutate({ id: exp.data!.id, reason: text.trim() }, {
                onError: (e) => Alert.alert('Could not void', String((e as Error).message)),
              });
            })}>
              <Button label="Void expense" variant="secondary" />
            </Pressable>
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
```

> NOTE: `Alert.prompt` is iOS-only. For Android, replace with a small inline TextInput + button. Acceptable for MVP; flag in follow-ups.

- [ ] **Step 3: Commit**

```bash
git add app/\(app\)/audit/expenses
git commit -m "feat(audit): expenses list + detail"
```

---

## Task 18: Settings — Audit history + Expense categories entries

**Files:**
- Modify: `app/(app)/settings/index.tsx`
- Create: `app/(app)/settings/audit-history/index.tsx`
- Create: `app/(app)/settings/audit-history/[id].tsx`
- Create: `app/(app)/settings/expense-categories.tsx`

- [ ] **Step 1: Add settings rows**

In `app/(app)/settings/index.tsx`, in the Management card:

```tsx
{membership && can.viewAudit(membership.role) ? (
  <>
    <Divider style={{ marginLeft: 52 }} />
    <Link href="/(app)/settings/audit-history" asChild>
      <NavRow icon="time-outline" label="Audit history" hint="Closed periods" />
    </Link>
  </>
) : null}
{membership?.role === 'admin' ? (
  <>
    <Divider style={{ marginLeft: 52 }} />
    <Link href="/(app)/settings/expense-categories" asChild>
      <NavRow icon="pricetags-outline" label="Expense categories" hint="Manage categories" />
    </Link>
  </>
) : null}
```

(Import `can` from `@/auth/permissions`.)

- [ ] **Step 2: Audit history list**

```tsx
// app/(app)/settings/audit-history/index.tsx
import React from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Card, Screen, ScreenHeader, Text } from '@/components/ui';
import { space } from '@/theme/tokens';
import { fetchMyMembership } from '@/insforge/queries/membership';
import { listClosedPeriods } from '@/insforge/queries/auditPeriods';

export default function AuditHistory() {
  const router = useRouter();
  const { data: me } = useQuery({ queryKey: ['membership'], queryFn: fetchMyMembership });
  const periods = useQuery({
    queryKey: ['audit-history', me?.org_id],
    queryFn: () => listClosedPeriods(me!.org_id),
    enabled: !!me,
  });

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}>
        <ScreenHeader showBack title="Audit history" onBack={() => router.back()} />
      </View>
      <FlatList
        data={periods.data ?? []}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: space.lg, gap: space.sm }}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/(app)/settings/audit-history/${item.id}`)}>
            <Card padded>
              <Text variant="bodyStrong">{new Date(item.opened_at).toLocaleDateString()}</Text>
              <Text variant="caption">
                {new Date(item.opened_at).toLocaleTimeString()} → {item.closed_at ? new Date(item.closed_at).toLocaleTimeString() : '—'}
              </Text>
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  );
}
```

- [ ] **Step 3: Audit history detail (read-only)**

```tsx
// app/(app)/settings/audit-history/[id].tsx
import React, { useState } from 'react';
import { Alert, ScrollView, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Screen, ScreenHeader, Text } from '@/components/ui';
import { color, radius, space } from '@/theme/tokens';
import { fetchPeriod } from '@/insforge/queries/auditPeriods';
import { fetchAuditAggregate } from '@/insforge/queries/audit';
import { fetchMyMembership } from '@/insforge/queries/membership';
import { useReopenPeriod } from '@/mutations/useReopenPeriod';
import { MetricsCards } from '@/features/audit/components/MetricsCards';

export default function AuditHistoryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: me } = useQuery({ queryKey: ['membership'], queryFn: fetchMyMembership });
  const period = useQuery({ queryKey: ['period', id], queryFn: () => fetchPeriod(id!), enabled: !!id });
  const aggregate = useQuery({ queryKey: ['audit', id], queryFn: () => fetchAuditAggregate(id!), enabled: !!id });
  const reopen = useReopenPeriod(me?.org_id ?? '');
  const [reason, setReason] = useState('');

  if (!period.data || !aggregate.data || !me) return <Screen padded><Text variant="body">Loading…</Text></Screen>;

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}>
        <ScreenHeader showBack title="Period" onBack={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <Card padded>
          <Text variant="caption">Closed</Text>
          <Text variant="body">{period.data.closed_at ? new Date(period.data.closed_at).toLocaleString() : '—'}</Text>
        </Card>
        <MetricsCards data={aggregate.data} />

        {me.role === 'admin' ? (
          <Card padded>
            <Text variant="label">Reopen period</Text>
            <Text variant="caption" style={{ marginTop: space.xs }}>Allowed only when current period is empty.</Text>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Reason"
              style={{ marginTop: space.sm, borderWidth: 1, borderColor: color.border, borderRadius: radius.md, padding: space.sm, color: color.textPrimary }}
            />
            <Button
              label={reopen.isPending ? 'Reopening…' : 'Reopen'}
              variant="secondary"
              onPress={() => {
                if (!reason.trim()) { Alert.alert('Reason required'); return; }
                reopen.mutate({ periodId: id!, reason: reason.trim() }, {
                  onSuccess: () => router.replace('/(app)/audit'),
                  onError: (e) => Alert.alert('Could not reopen', String((e as Error).message)),
                });
              }}
              style={{ marginTop: space.sm }}
            />
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
```

- [ ] **Step 4: Expense categories CRUD**

```tsx
// app/(app)/settings/expense-categories.tsx
import React, { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Card, Screen, ScreenHeader, Text, Button } from '@/components/ui';
import { color, radius, space } from '@/theme/tokens';
import { fetchMyMembership } from '@/insforge/queries/membership';
import { listExpenseCategories } from '@/insforge/queries/expenseCategories';
import { useUpsertExpenseCategory } from '@/mutations/useUpsertExpenseCategory';

export default function ExpenseCategories() {
  const router = useRouter();
  const { data: me } = useQuery({ queryKey: ['membership'], queryFn: fetchMyMembership });
  const cats = useQuery({
    queryKey: ['expense-categories', me?.org_id],
    queryFn: () => listExpenseCategories(me!.org_id),
    enabled: !!me,
  });
  const upsert = useUpsertExpenseCategory(me?.org_id ?? '');
  const [newName, setNewName] = useState('');

  if (me?.role !== 'admin') {
    return <Screen padded><Text variant="body">Admins only.</Text></Screen>;
  }

  return (
    <Screen padded={false}>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}>
        <ScreenHeader showBack title="Expense categories" onBack={() => router.back()} />
      </View>
      <FlatList
        data={cats.data ?? []}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: space.lg, gap: space.sm }}
        ListFooterComponent={
          <Card padded style={{ marginTop: space.lg }}>
            <Text variant="label">Add new</Text>
            <TextInput value={newName} onChangeText={setNewName} placeholder="Category name" style={styles.input} />
            <Button
              label={upsert.isPending ? 'Saving…' : 'Add'}
              onPress={() => {
                if (!newName.trim()) return;
                upsert.mutate({ name: newName.trim() }, {
                  onSuccess: () => setNewName(''),
                  onError: (e) => Alert.alert('Could not save', String((e as Error).message)),
                });
              }}
              style={{ marginTop: space.sm }}
            />
          </Card>
        }
        renderItem={({ item }) => (
          <Card padded>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <Text variant="bodyStrong" style={{ flex: 1, opacity: item.active ? 1 : 0.5 }}>{item.name}</Text>
              <Pressable
                onPress={() => upsert.mutate({ id: item.id, name: item.name, active: !item.active, sort_order: item.sort_order })}
                accessibilityLabel={item.active ? 'Deactivate' : 'Activate'}
                hitSlop={12}
              >
                <Ionicons name={item.active ? 'eye-outline' : 'eye-off-outline'} size={20} color={color.textSecondary} />
              </Pressable>
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, borderColor: color.border, borderRadius: radius.md, padding: space.sm, color: color.textPrimary, fontSize: 16, marginTop: space.sm },
});
```

- [ ] **Step 5: Commit**

```bash
git add app/\(app\)/settings
git commit -m "feat(audit): audit history + expense categories settings screens"
```

---

## Task 19: Komanda creation passes period_id

**Files:**
- Modify: `src/offline/handlers/createKomanda.ts`

- [ ] **Step 1: Inspect existing handler**

Open `src/offline/handlers/createKomanda.ts`. Identify the insert call. Add `period_id` lookup before insert:

```ts
import { fetchOpenPeriod } from '@/insforge/queries/auditPeriods';

// inside the handler, before INSERT komandas:
const period = await fetchOpenPeriod(orgId);

// add `period_id: period.id` to the insert payload.
```

- [ ] **Step 2: Type-check + smoke**

Run: `pnpm tsc --noEmit`
Manually create a komanda; query DB; verify `period_id` populated.

- [ ] **Step 3: Commit**

```bash
git add src/offline/handlers/createKomanda.ts
git commit -m "feat(komanda): attach period_id at sync time"
```

---

## Task 20: Integration test — period lifecycle

**Files:**
- Create: `tests/insforge/auditPeriods.integration.test.ts`

- [ ] **Step 1: Tests**

```ts
import { beforeAll, describe, expect, it } from 'vitest';
import { closeDay, fetchOpenPeriod, listClosedPeriods, reopenPeriod } from '@/insforge/queries/auditPeriods';
import { insertExpense } from '@/insforge/queries/expenses';
import { signInAs, signUpUser, createTestOrg, createKomandaForOrg, closeKomandaForOrg } from '../helpers/insforge';

describe('audit period lifecycle (integration)', () => {
  let orgId: string;
  let admin: { id: string; email: string };

  beforeAll(async () => {
    admin = await signUpUser('audit-admin@test.local');
    await signInAs(admin);
    orgId = await createTestOrg(admin.id, 'Audit Org');
  });

  it('open period exists at org creation', async () => {
    const p = await fetchOpenPeriod(orgId);
    expect(p.status).toBe('open');
  });

  it('blocks close when open komandas exist', async () => {
    const period = await fetchOpenPeriod(orgId);
    await createKomandaForOrg(orgId, period.id, admin.id);
    await expect(closeDay(orgId)).rejects.toThrow(/open_komandas/);
  });

  it('closes successfully after open komandas resolved; new period auto-opens', async () => {
    const period = await fetchOpenPeriod(orgId);
    await closeKomandaForOrg(orgId, period.id);
    const closed = await closeDay(orgId);
    expect(closed.status).toBe('closed');
    const next = await fetchOpenPeriod(orgId);
    expect(next.id).not.toBe(closed.id);
    const closedList = await listClosedPeriods(orgId);
    expect(closedList.find((p) => p.id === closed.id)).toBeTruthy();
  });

  it('reopen blocked when current period non-empty', async () => {
    const closedList = await listClosedPeriods(orgId);
    const target = closedList[0];
    const current = await fetchOpenPeriod(orgId);
    await insertExpense({
      org_id: orgId, period_id: current.id, amount_cents: 100,
      category_id: null, category_other_label: 'Test',
      note: 'block reopen', paid_by: 'cash',
      local_uuid: crypto.randomUUID(), created_by_auth_user_id: admin.id,
    });
    await expect(reopenPeriod(target.id, 'fix')).rejects.toThrow(/current_period_not_empty/);
  });

  it('reopen succeeds when current period empty', async () => {
    // Close current period (which is non-empty from previous test) then verify
    // that the NEW empty current period allows reopening older one.
    const current = await fetchOpenPeriod(orgId);
    // Need to drain: close komandas (none) and call closeDay; the previous
    // expense doesn't block close. Close current.
    await closeDay(orgId);
    const closedList = await listClosedPeriods(orgId);
    const oldest = closedList[closedList.length - 1];
    const reopened = await reopenPeriod(oldest.id, 'audit fix');
    expect(reopened.status).toBe('open');
    const cur = await fetchOpenPeriod(orgId);
    expect(cur.id).toBe(oldest.id);
  });
});
```

- [ ] **Step 2: Add helpers**

In `tests/helpers/insforge.ts` add `createKomandaForOrg(orgId, periodId, userId)` and `closeKomandaForOrg(orgId, periodId)` using the service-role client. (Mirror existing test patterns; minimal records sufficient.)

- [ ] **Step 3: Run**

Run: `pnpm test tests/insforge/auditPeriods.integration.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/insforge/auditPeriods.integration.test.ts tests/helpers/insforge.ts
git commit -m "test(audit): period lifecycle + reopen guards"
```

---

## Task 21: Integration test — expense edit/void

**Files:**
- Create: `tests/insforge/expenses.integration.test.ts`

- [ ] **Step 1: Tests**

```ts
import { beforeAll, describe, expect, it } from 'vitest';
import { fetchOpenPeriod } from '@/insforge/queries/auditPeriods';
import { insertExpense, listExpensesForPeriod, updateExpense, voidExpense } from '@/insforge/queries/expenses';
import { signInAs, signUpUser, createTestOrg } from '../helpers/insforge';

describe('expense write paths (integration)', () => {
  let orgId: string;
  let admin: { id: string; email: string };
  let periodId: string;

  beforeAll(async () => {
    admin = await signUpUser('exp-admin@test.local');
    await signInAs(admin);
    orgId = await createTestOrg(admin.id, 'Expense Org');
    periodId = (await fetchOpenPeriod(orgId)).id;
  });

  it('insert + list', async () => {
    const e = await insertExpense({
      org_id: orgId, period_id: periodId, amount_cents: 250,
      category_id: null, category_other_label: 'Misc',
      note: 'sugar', paid_by: 'cash',
      local_uuid: crypto.randomUUID(), created_by_auth_user_id: admin.id,
    });
    const list = await listExpensesForPeriod(periodId);
    expect(list.find((x) => x.id === e.id)).toBeTruthy();
  });

  it('update succeeds within open period', async () => {
    const e = await insertExpense({
      org_id: orgId, period_id: periodId, amount_cents: 100,
      category_id: null, category_other_label: 'Misc',
      note: 'edit-me', paid_by: 'cash',
      local_uuid: crypto.randomUUID(), created_by_auth_user_id: admin.id,
    });
    const updated = await updateExpense(e.id, { amount_cents: 200, note: 'edited' });
    expect(updated.amount_cents).toBe(200);
    expect(updated.note).toBe('edited');
  });

  it('void marks row + sets reason', async () => {
    const e = await insertExpense({
      org_id: orgId, period_id: periodId, amount_cents: 999,
      category_id: null, category_other_label: 'Misc',
      note: 'void-me', paid_by: 'cash',
      local_uuid: crypto.randomUUID(), created_by_auth_user_id: admin.id,
    });
    const voided = await voidExpense(e.id, 'duplicate', admin.id);
    expect(voided.voided).toBe(true);
    expect(voided.void_reason).toBe('duplicate');
  });
});
```

- [ ] **Step 2: Run**

Run: `pnpm test tests/insforge/expenses.integration.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/insforge/expenses.integration.test.ts
git commit -m "test(expenses): insert/update/void"
```

---

## Task 22: Final smoke + cleanup

- [ ] **Step 1: Full test run**

Run: `pnpm test`
Expected: green.

- [ ] **Step 2: Type-check**

Run: `pnpm tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual smoke**

1. Sign in as cashier → Audit tab visible from Komandas header → tap → Audit screen renders zero state.
2. Add expense (cash, $5, "ice") → appears in Recent expenses; metrics update.
3. Open + close a komanda → Earnings update; cash drawer reflects.
4. Tap "Close day" → confirmation shows totals → confirm → land in audit history list with one entry.
5. Settings → Audit history → tap entry → see read-only metrics.
6. As admin, reopen with reason → land back in Audit tab with reopened period as current.
7. As waiter (switch role), Audit tab redirects to komandas; Settings has no Audit history / Expense categories rows.

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "chore: expenses & audit plan complete"
```

---

## Done criteria

- Audit period entity with single-open invariant; close + reopen RPCs enforce it.
- Expenses + categories CRUD with offline create + edit-window + void semantics.
- Audit aggregate (earnings, expenses, net, cash drawer, by-category, per-waiter) renders for current and historical periods.
- Settings exposes Audit history (admin/cashier) and Expense categories (admin).
- Permission gating per role across all new screens.
- Integration tests cover period lifecycle, reopen guards, expense write paths.

## Known follow-ups (deferred from this plan)

- **Inline expense edit form** — predicate (`canEditExpense`) and update query are wired; UI form not built yet. Add when polish sweep happens.
- **Bottom Tabs nav** — current plan uses a header icon to reach `/audit`; promote to a real Tabs layout when kitchen tab is added.
- **Android void reason input** — `Alert.prompt` is iOS-only; replace with inline TextInput.
- **Expense reorder UI** — categories CRUD missing drag-to-reorder; `sort_order` field exists.
