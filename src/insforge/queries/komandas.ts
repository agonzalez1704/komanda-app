import { z } from 'zod';
import { insforge } from '@/insforge/client';
import { KomandaRow, type KomandaRowT } from '@/insforge/schemas';

/**
 * Fetch komandas for the given local day, PLUS any still-active komandas
 * regardless of when they were opened.
 *
 * Why the "still-active" clause:
 *   - The server stores `opened_at` in UTC; we filter against the user's
 *     local-midnight boundaries converted to UTC. In a negative-offset
 *     timezone (e.g. Mexico, UTC-6) a komanda opened at 22:00 local gets
 *     stored as the NEXT day in UTC. Without the `or(status)` clause, a
 *     komanda opened late last night that's still on the table "today"
 *     would be invisible from the list.
 *   - Also covers the case where someone leaves a komanda open across
 *     midnight and comes back the next day to close it.
 *
 * We also use `safeParse` per-row so that a single row with a surprise value
 * (e.g. a new status enum added server-side) doesn't nuke the whole list.
 */
export async function fetchKomandasForDate(date: Date): Promise<KomandaRowT[]> {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const { data, error } = await insforge.database
    .from('komandas')
    .select('*')
    // Anything opened in today's local-day window, OR anything still active
    // (not closed) regardless of when it was opened.
    .or(
      `and(opened_at.gte.${start.toISOString()},opened_at.lt.${end.toISOString()}),status.neq.closed`,
    )
    .order('opened_at', { ascending: false });
  if (error) throw error;

  const out: KomandaRowT[] = [];
  for (const r of data ?? []) {
    const parsed = KomandaRow.safeParse(r);
    if (parsed.success) {
      out.push(parsed.data);
    } else if (__DEV__) {
      console.warn(
        '[fetchKomandasForDate] skipping unparseable row',
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
