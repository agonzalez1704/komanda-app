# Expenses & Audit — Design

**Date:** 2026-04-29
**Status:** Approved
**Scope:** Spec 2 of 2 (paired with `2026-04-28-roles-and-invitations-design.md`)
**Depends on:** Spec 1 (roles `admin` / `cashier` / `waiter` / `cook`, permission helpers)

## Goal

Track operational expenses (purchases, repairs, etc.) during the operating day and produce an end-of-day audit showing earnings, expenses, and net profit. Lock data when the day is closed so historical audits are reliable.

## Non-goals

- Receipt photo attachment (deferred to v2)
- Multi-currency / FX
- Tax calculations / fiscal reports
- Expense approval workflows
- Recurring/scheduled expenses
- Petty cash float as a distinct accounting entity

## Concepts

### Audit period
A bounded window of operating activity for an org. Exactly one period is `open` per org at any time. New komandas and expenses attach to the current open period. Closing creates a snapshot (period status flips, new period auto-opens).

### Operating day boundary
**Manual close.** Admin or cashier triggers "Close day" when ready. No clock-driven auto-close.

### Editability
Expenses are editable by their creator within 15 minutes of creation, only while the owning period is open. Admins may void any non-voided expense in an open period at any time (with a reason). All edits/voids blocked once the period is closed.

## Data model

### `audit_periods` (new)

```ts
export const AuditPeriodRow = z.object({
  id: uuid,
  org_id: uuid,
  status: z.enum(['open', 'closed']),
  opened_at: iso,
  opened_by_auth_user_id: uuid,
  closed_at: iso.nullable(),
  closed_by_auth_user_id: uuid.nullable(),
  reopened_at: iso.nullable(),
  reopened_by_auth_user_id: uuid.nullable(),
  reopen_reason: z.string().nullable(),
});
```

**Invariant:** exactly one row per `org_id` with `status='open'` at any time.

### `expense_categories` (new, per-org CRUD)

```ts
export const ExpenseCategoryRow = z.object({
  id: uuid,
  org_id: uuid,
  name: z.string(),
  active: z.boolean(),
  sort_order: z.number().int(),
  created_at: iso,
});
```

### `expenses` (new)

```ts
export const ExpensePaidBy = z.enum(['cash', 'card', 'transfer', 'personal']);

export const ExpenseRow = z.object({
  id: uuid,
  org_id: uuid,
  period_id: uuid,                      // FK audit_periods, set at creation
  amount_cents: z.number().int().positive(),
  category_id: uuid.nullable(),         // FK expense_categories; null = "other"
  category_other_label: z.string().nullable(), // required when category_id is null
  note: z.string(),                     // required justification
  paid_by: ExpensePaidBy,
  voided: z.boolean(),
  voided_at: iso.nullable(),
  voided_by_auth_user_id: uuid.nullable(),
  void_reason: z.string().nullable(),
  created_at: iso,
  created_by_auth_user_id: uuid,
  updated_at: iso,
  local_uuid: uuid,                     // offline support
});
```

### `komandas` extension

```ts
+ period_id: uuid       // FK audit_periods, set at open()
```

### Bootstrap / migration

- New org: insert first `audit_periods` row with `status='open'` at org creation.
- Existing orgs: backfill one open period per org. Update existing komandas to point at it.

## Permissions

Per spec 1 matrix:

| Action | admin | cashier | waiter | cook |
|---|---|---|---|---|
| Create expense | ✓ | ✓ | ✗ | ✗ |
| Edit own expense (15min, open period) | ✓ | ✓ | — | — |
| Void any expense (open period) | ✓ | ✗ | ✗ | ✗ |
| Close day | ✓ | ✓ | ✗ | ✗ |
| Reopen closed period | ✓ | ✗ | ✗ | ✗ |
| Manage expense categories | ✓ | ✗ | ✗ | ✗ |
| View audit (current + history) | ✓ | ✓ | ✗ | ✗ |

## Screens

### S1. Audit tab (bottom nav)
Visible to `admin` + `cashier`.

- Header: "Audit" + period chip ("Open • since Apr 28 9:00am")
- Top button: **Close day** (disabled when open komandas exist; badge shows count; tap opens "resolve open komandas" modal)
- Metrics cards (scroll):
  - **Net profit** (large) = earnings − expenses
  - Earnings total + by payment method (cash / card / transfer)
  - Expenses total + by paid_by
  - Cash drawer expected = (cash earnings) − (cash expenses)
- Sections:
  - Earnings by product category
  - Per-waiter earnings (count + total)
  - Recent expenses (last 5) → "View all"
  - Recent komandas (last 5) → "View all"
- FAB "+" → Add expense modal

### S2. Add expense modal (bottom sheet)
- Amount input (numeric pad, currency formatted)
- Category picker: chips from `expense_categories` (active only) + "Other" → text input
- Paid-by segmented: `cash / card / transfer / personal`
- Note textarea (required)
- Save button

### S3. Expense detail `/audit/expenses/[id]`
- Read-only fields
- Edit button (visible when creator AND `<15min` AND period open AND not voided)
- Void button (admin only AND period open AND not voided) → confirm + reason input

### S4. Expenses list `/audit/expenses`
- Filters: period selector (defaults to current), category, paid_by
- List: amount | category | paid_by | created_at | created_by | voided badge

### S5. Komandas list (audit context)
Reuse existing komandas list w/ `?period_id=` filter.

### S6. Close day flow
- Tap "Close day" → confirm modal showing snapshot preview (totals)
- If open komandas exist: blocking modal lists them with deep-links to resolve
- Confirm → period closes, new period auto-opens
- UI navigates to closed-period view

### S7. Settings → Expense categories (admin only)
- List + reorder + edit name + soft-deactivate (`active=false`, hidden from picker but kept for historical expense display)
- FAB "+" add new

### S8. Settings → Audit history
- List of closed periods, newest first: date range, totals (earnings / expenses / net), status badge
- Tap → reuse Audit tab layout in **read-only** mode (no Add expense, no Close day)
- Admin-only **Reopen period** button → modal w/ reason textarea

## Data flow

### Bootstrap
Org creation seeds first `audit_periods` row (`status='open'`).

### Open komanda
Read current open period for org → set komanda `period_id`.

### Create expense
Read current open period → attach `period_id`. Insert row.

**Offline:** queue mutation w/ `local_uuid` in existing outbox. `period_id` resolved at sync commit time using current open period at that moment. If period closed between offline-create and sync → server rejects, client surfaces conflict (see Error states).

### Edit expense
Allowed iff: `creator == current_user AND now − created_at < 15min AND period.status == 'open' AND !voided`. UI hides Edit button when conditions fail; server enforces same check.

### Void expense (admin only)
Allowed iff: `period.status == 'open' AND !voided`. Sets `voided=true`, requires `void_reason`. Voided expenses excluded from totals; visible in list w/ strikethrough.

### Close day
1. **Pre-flight:** query open komandas in current period. If `count > 0` → block w/ list.
2. **Atomic transaction:**
   - Update current period: `status='closed'`, `closed_at=now`, `closed_by_auth_user_id`.
   - Insert new period for org: `status='open'`, `opened_at=now`, `opened_by_auth_user_id`.
3. All expenses+komandas already point at now-closed period — no row updates needed.
4. UI navigates to closed-period read-only view.

### Reopen period (admin only)
**Constraint:** the current open period must have zero activity (no komandas, no expenses).

1. Pre-flight: query current open period for activity. If non-empty → block w/ message "Close today's period first."
2. **Atomic transaction:**
   - Delete current empty open period.
   - Update target period: `status='open'`, `reopened_at=now`, `reopened_by_auth_user_id`, `reopen_reason`.
3. UI navigates to now-open period (was closed). Admin edits/voids/etc.
4. **Re-close:** uses same Close day flow. New period auto-opens after re-close.

### Audit aggregation queries (per `period_id`)
- **Earnings:** `SUM(komandas.total_cents)` where `status='closed'`, grouped by `payment_method`.
- **Earnings by category:** join `komanda_items → products.category`, SUM.
- **Per-waiter earnings:** GROUP BY `opened_by_auth_user_id`.
- **Expenses:** `SUM(amount_cents)` where `!voided`, grouped by `paid_by` and `category_id`.
- **Net profit:** total earnings − total expenses (including personal).
- **Cash drawer expected:** (cash earnings) − (cash expenses). Personal expenses excluded.

## Authorization (RLS)

| Table | Read | Write |
|---|---|---|
| `audit_periods` | same org | admin or cashier (insert/update); reopen-update admin only |
| `expense_categories` | same org | admin only |
| `expenses` | same org (UI further restricts to admin+cashier; waiter/cook blocked at route) | admin or cashier |

`komandas.period_id` write: enforced server-side at insert (cannot be set client-side).

## Offline behavior

- Expenses queue through existing offline outbox (same infra as komandas).
- **Period close requires online** (involves invariant check + atomic op). Disable button when offline.
- **Stale-period sync:** if expense mutation lands server after period closed → server rejects, client surfaces conflict and offers re-create against current open period.

## Error states

| Case | UX |
|---|---|
| Close day with open komandas | Modal: "N open komandas. Close them first." + list w/ deep-links |
| Edit window expired (>15min) | Toast: "Edit window closed. Ask admin to void." |
| Edit/void on closed period | Toast: "This period is closed. Reopen first." |
| Reopen blocked (activity in current period) | Modal: "Close today's period first to reopen an older one." |
| Sync rejected (period closed during sync) | Banner: "Period closed during sync. Re-enter expense in new period." (offers retry button that re-attaches to current open period) |
| Close day while offline | Button disabled w/ tooltip: "Connect to close day." |
| Net profit negative | Display in red |
| Category "Other" w/ no label | Inline form error: "Describe the category." |

## Testing

### Unit
- Aggregation pure fns: earnings, expenses, net, cash drawer (in-memory inputs, edge cases: zero, negative net, all-personal expenses)
- `canEditExpense(creator, now, expense, period)` predicate (every branch)
- Personal expense exclusion from cash drawer reconciliation
- Permission gating for expense + audit + close-day per role

### Integration (real InsForge)
- **Period lifecycle:** open → expenses+komandas attach → close blocked by open komanda → close succeeds → new period auto-opens
- **Reopen happy path:** close period A → period B auto-opens (empty) → admin reopens A → period B deleted → A is open
- **Reopen blocked:** close A → period B opens → add expense to B → reopen A blocked
- **Void:** admin voids open-period expense → totals exclude it; voided expense visible in list
- **Edit window:** creator edits within 15min → ok; after 15min → rejected; non-creator → rejected
- **Offline expense:** create offline → sync online → `period_id` attached
- **Stale sync conflict:** close period via second client → first client syncs offline expense → rejected w/ conflict surfaced

### E2E
- Cashier full day: open komandas → add expenses → close komandas → close day → audit shows correct net
- Admin reopens past period → voids one expense w/ reason → re-closes period → audit history shows updated totals + reopen metadata

## Open questions

None. All resolved during brainstorming.

## Out of scope (deferred)

- Receipt photo attachment
- Recurring expenses / templates
- Tax / fiscal reports
- Approval workflows
- CSV / PDF export of audit
- Trend charts across periods (daily/weekly/monthly)
