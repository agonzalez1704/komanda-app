import { z } from 'zod';
import { insforge } from '@/insforge/client';
import { KomandaComboRow, type KomandaComboRowT } from '@/insforge/schemas';

const List = z.array(KomandaComboRow);

export async function listKomandaCombos(
  komandaId: string,
): Promise<KomandaComboRowT[]> {
  const { data, error } = await insforge.database
    .from('komanda_combos')
    .select('*')
    .eq('komanda_id', komandaId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return List.parse(data ?? []);
}

export async function addKomandaCombo(input: {
  komanda_id: string;
  combo_id: string | null;
  local_uuid: string;
  name_snapshot: string;
  category_snapshot: string;
  price_cents_snapshot: number;
  children: Array<{
    item_local_uuid: string;
    product_id: string | null;
    variant_id: string | null;
    quantity: number;
    product_name_snapshot: string;
    variant_name_snapshot: string | null;
    note_text: string | null;
    modifiers: Array<{ modifier_id: string | null; name_snapshot: string }>;
  }>;
}): Promise<KomandaComboRowT> {
  const { data, error } = await insforge.database.rpc('add_komanda_combo', {
    p_komanda_id: input.komanda_id,
    p_combo_id: input.combo_id,
    p_local_uuid: input.local_uuid,
    p_name_snapshot: input.name_snapshot,
    p_category_snapshot: input.category_snapshot,
    p_price_cents_snapshot: input.price_cents_snapshot,
    p_children: input.children,
  });
  if (error) throw error;
  return KomandaComboRow.parse(data);
}

export async function deleteKomandaCombo(id: string): Promise<void> {
  const { error } = await insforge.database
    .from('komanda_combos')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
