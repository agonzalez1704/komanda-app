import { z } from 'zod';
import { insforge } from '@/insforge/client';
import {
  ComboRow,
  ComboItemRow,
  type ComboRowT,
  type ComboItemRowT,
} from '@/insforge/schemas';

const ComboList = z.array(ComboRow);
const ComboItemList = z.array(ComboItemRow);

export async function listCombos(
  orgId: string,
  opts: { activeOnly?: boolean } = {},
): Promise<ComboRowT[]> {
  let q = insforge.database
    .from('combos')
    .select('*')
    .eq('org_id', orgId)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (opts.activeOnly) q = q.eq('active', true);
  const { data, error } = await q;
  if (error) throw error;
  return ComboList.parse(data ?? []);
}

export async function fetchCombo(
  id: string,
): Promise<{ combo: ComboRowT; items: ComboItemRowT[] }> {
  const [{ data: combo, error: e1 }, { data: items, error: e2 }] = await Promise.all([
    insforge.database.from('combos').select('*').eq('id', id).single(),
    insforge.database
      .from('combo_items')
      .select('*')
      .eq('combo_id', id)
      .order('sort_order', { ascending: true }),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  return {
    combo: ComboRow.parse(combo),
    items: ComboItemList.parse(items ?? []),
  };
}

export async function upsertCombo(input: {
  id?: string;
  name: string;
  category: string;
  price_cents: number;
  active?: boolean;
  sort_order?: number;
  items: Array<{
    product_id: string;
    variant_id?: string | null;
    quantity: number;
    sort_order?: number;
  }>;
}): Promise<ComboRowT> {
  const { data, error } = await insforge.database.rpc('upsert_combo', {
    p_combo: {
      id: input.id ?? null,
      name: input.name,
      category: input.category,
      price_cents: input.price_cents,
      active: input.active ?? true,
      sort_order: input.sort_order ?? 0,
    },
    p_items: input.items,
  });
  if (error) throw error;
  return ComboRow.parse(data);
}

export async function deleteCombo(id: string): Promise<void> {
  const { error } = await insforge.database.from('combos').delete().eq('id', id);
  if (error) throw error;
}
