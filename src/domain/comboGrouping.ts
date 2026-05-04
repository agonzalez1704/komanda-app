export interface ItemInput {
  id: string;
  combo_id: string | null;
  quantity: number;
  product_name_snapshot: string;
  variant_name_snapshot: string | null;
  unit_price_cents: number;
  modifiers?: { name_snapshot: string }[];
  note_text?: string | null;
}

export interface ComboInput {
  id: string;
  name_snapshot: string;
  category_snapshot: string;
  price_cents_snapshot: number;
}

export type GroupedRow =
  | { kind: 'item'; item: ItemInput }
  | { kind: 'combo'; combo: ComboInput; children: ItemInput[] };

export function groupItemsByCombo(input: {
  items: ItemInput[];
  combos: ComboInput[];
}): GroupedRow[] {
  const comboById = new Map(input.combos.map((c) => [c.id, c] as const));
  const childrenById = new Map<string, ItemInput[]>();
  const out: GroupedRow[] = [];

  for (const it of input.items) {
    if (it.combo_id && comboById.has(it.combo_id)) {
      let group = childrenById.get(it.combo_id);
      if (!group) {
        group = [];
        childrenById.set(it.combo_id, group);
        out.push({ kind: 'combo', combo: comboById.get(it.combo_id)!, children: group });
      }
      group.push(it);
    } else {
      out.push({ kind: 'item', item: it });
    }
  }

  return out;
}
