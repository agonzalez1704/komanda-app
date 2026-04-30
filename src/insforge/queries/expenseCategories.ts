import { z } from 'zod';
import { insforge } from '@/insforge/client';
import { ExpenseCategoryRow, type ExpenseCategoryRowT } from '@/insforge/schemas';

const List = z.array(ExpenseCategoryRow);

export async function listExpenseCategories(
  orgId: string,
  opts: { activeOnly?: boolean } = {},
): Promise<ExpenseCategoryRowT[]> {
  let q = insforge.database
    .from('expense_categories')
    .select('*')
    .eq('org_id', orgId)
    .order('sort_order', { ascending: true });
  if (opts.activeOnly) q = q.eq('active', true);
  const { data, error } = await q;
  if (error) throw error;
  return List.parse(data ?? []);
}

export async function upsertExpenseCategory(input: {
  id?: string;
  orgId: string;
  name: string;
  active?: boolean;
  sort_order?: number;
}): Promise<ExpenseCategoryRowT> {
  const row: Record<string, unknown> = {
    org_id: input.orgId,
    name: input.name,
    active: input.active ?? true,
    sort_order: input.sort_order ?? 0,
  };
  if (input.id) row.id = input.id;
  const { data, error } = await insforge.database
    .from('expense_categories')
    .upsert(row)
    .select('*')
    .single();
  if (error) throw error;
  return ExpenseCategoryRow.parse(data);
}
