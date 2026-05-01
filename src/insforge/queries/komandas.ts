import { z } from 'zod';
import { insforge } from '@/insforge/client';
import { KomandaRow, type KomandaRowT } from '@/insforge/schemas';

// safeParse per-row so a single row with a surprise enum value doesn't nuke
// the whole list.
export async function fetchKomandas(): Promise<KomandaRowT[]> {
  const { data, error } = await insforge.database
    .from('komandas')
    .select('*')
    .order('opened_at', { ascending: false });
  if (error) throw error;

  const out: KomandaRowT[] = [];
  for (const r of data ?? []) {
    const parsed = KomandaRow.safeParse(r);
    if (parsed.success) {
      out.push(parsed.data);
    } else if (__DEV__) {
      console.warn(
        '[fetchKomandas] skipping unparseable row',
        parsed.error.flatten(),
        r,
      );
    }
  }
  return out;
}

export async function fetchKomandaById(id: string): Promise<KomandaRowT | null> {
  const { data, error } = await insforge.database
    .from('komandas')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return KomandaRow.parse(data);
}

export const KomandaItemRow = z.object({
  id: z.string().uuid(),
  komanda_id: z.string().uuid(),
  org_id: z.string().uuid(),
  product_id: z.string().uuid().nullable(),
  variant_id: z.string().uuid().nullable(),
  quantity: z.number().int(),
  unit_price_cents: z.number().int(),
  product_name_snapshot: z.string(),
  variant_name_snapshot: z.string().nullable(),
  note_text: z.string().nullable(),
  created_at: z.string(),
});
export type KomandaItemRowT = z.infer<typeof KomandaItemRow>;

export const KomandaItemModifierRow = z.object({
  id: z.string().uuid(),
  komanda_item_id: z.string().uuid(),
  modifier_id: z.string().uuid().nullable(),
  name_snapshot: z.string(),
});
export type KomandaItemModifierRowT = z.infer<typeof KomandaItemModifierRow>;

export async function fetchItemsForKomanda(
  komandaId: string
): Promise<(KomandaItemRowT & { modifiers: KomandaItemModifierRowT[] })[]> {
  const { data: items, error } = await insforge.database
    .from('komanda_items')
    .select('*')
    .eq('komanda_id', komandaId)
    .order('created_at', { ascending: true });
  if (error) throw error;

  const parsedItems = (items ?? []).map((r: any) => KomandaItemRow.parse(r));
  if (parsedItems.length === 0) return [];

  const { data: mods, error: modErr } = await insforge.database
    .from('komanda_item_modifiers')
    .select('*')
    .in('komanda_item_id', parsedItems.map((i: KomandaItemRowT) => i.id));
  if (modErr) throw modErr;

  const parsedMods = (mods ?? []).map((r: any) => KomandaItemModifierRow.parse(r));
  const byItem = new Map<string, KomandaItemModifierRowT[]>();
  for (const m of parsedMods) {
    const arr = byItem.get(m.komanda_item_id) ?? [];
    arr.push(m);
    byItem.set(m.komanda_item_id, arr);
  }
  return parsedItems.map((i: KomandaItemRowT) => ({ ...i, modifiers: byItem.get(i.id) ?? [] }));
}
