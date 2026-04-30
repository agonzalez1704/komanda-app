import { z } from 'zod';
import { insforge } from '@/insforge/client';
import { ExpenseRow, type ExpenseRowT, type ExpensePaidByT } from '@/insforge/schemas';

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
  paid_by: ExpensePaidByT;
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

export async function updateExpense(
  id: string,
  patch: Partial<{
    amount_cents: number;
    category_id: string | null;
    category_other_label: string | null;
    note: string;
    paid_by: ExpensePaidByT;
  }>,
): Promise<ExpenseRowT> {
  const { data, error } = await insforge.database
    .from('expenses')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return ExpenseRow.parse(data);
}

export async function voidExpense(
  id: string,
  reason: string,
  byUserId: string,
): Promise<ExpenseRowT> {
  const { data, error } = await insforge.database
    .from('expenses')
    .update({
      voided: true,
      voided_at: new Date().toISOString(),
      void_reason: reason,
      voided_by_auth_user_id: byUserId,
    })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return ExpenseRow.parse(data);
}
