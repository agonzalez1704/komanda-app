import { fetchOpenPeriod } from '@/insforge/queries/auditPeriods';
import { insertExpense } from '@/insforge/queries/expenses';
import type { QueuedMutation } from '@/offline/queue';
import type { ExpensePaidByT } from '@/insforge/schemas';

export interface CreateExpensePayload {
  org_id: string;
  local_uuid: string;
  amount_cents: number;
  category_id: string | null;
  category_other_label: string | null;
  note: string;
  paid_by: ExpensePaidByT;
  created_by_auth_user_id: string;
}

export function createExpenseHandler() {
  return async function handle(m: QueuedMutation): Promise<void> {
    const p = m.payload as CreateExpensePayload;
    // Resolve the current open period at sync time (not enqueue time) so the
    // expense lands in whichever period is open NOW. If the period closed
    // between enqueue and sync, the server-side period_id check + RLS will
    // surface a friendly error rather than silently rebooking.
    const period = await fetchOpenPeriod(p.org_id);
    await insertExpense({
      org_id: p.org_id,
      period_id: period.id,
      amount_cents: p.amount_cents,
      category_id: p.category_id,
      category_other_label: p.category_other_label,
      note: p.note,
      paid_by: p.paid_by,
      local_uuid: p.local_uuid,
      created_by_auth_user_id: p.created_by_auth_user_id,
    });
  };
}
