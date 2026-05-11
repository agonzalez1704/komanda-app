import { groupItemsByCombo } from '@/domain/comboGrouping';

const item = (over: Partial<any> = {}) => ({
  id: 'i', combo_id: null, quantity: 1, product_name_snapshot: 'X',
  variant_name_snapshot: null, variant_2_name_snapshot: null, unit_price_cents: 100, modifiers: [], note_text: null,
  ...over,
});

const combo = (over: Partial<any> = {}) => ({
  id: 'c1', name_snapshot: 'Combo 1', category_snapshot: 'Combos',
  price_cents_snapshot: 6900, ...over,
});

describe('groupItemsByCombo', () => {
  it('returns flat items when no combos', () => {
    const rows = groupItemsByCombo({ items: [item({ id: 'i1' })], combos: [] });
    expect(rows).toEqual([{ kind: 'item', item: expect.objectContaining({ id: 'i1' }) }]);
  });

  it('nests children under matching combo header', () => {
    const c = combo({ id: 'c1' });
    const rows = groupItemsByCombo({
      items: [item({ id: 'i1', combo_id: 'c1' }), item({ id: 'i2', combo_id: 'c1' }), item({ id: 'i3' })],
      combos: [c],
    });
    expect(rows).toHaveLength(2); // combo group + free item
    expect(rows[0]).toMatchObject({
      kind: 'combo',
      combo: expect.objectContaining({ id: 'c1' }),
      children: [expect.objectContaining({ id: 'i1' }), expect.objectContaining({ id: 'i2' })],
    });
    expect(rows[1]).toMatchObject({ kind: 'item', item: expect.objectContaining({ id: 'i3' }) });
  });

  it('preserves item insertion order within a combo and across the list', () => {
    const c1 = combo({ id: 'c1' });
    const c2 = combo({ id: 'c2', name_snapshot: 'Combo 2' });
    const rows = groupItemsByCombo({
      items: [
        item({ id: 'a', combo_id: 'c1' }),
        item({ id: 'b' }),
        item({ id: 'c', combo_id: 'c2' }),
        item({ id: 'd', combo_id: 'c1' }),
      ],
      combos: [c1, c2],
    });
    // combos come in the order they first appear in items
    const flat = rows.flatMap((r) => r.kind === 'combo' ? [r.combo.id, ...r.children.map((x) => x.id)] : [r.item.id]);
    expect(flat).toEqual(['c1', 'a', 'd', 'b', 'c2', 'c']);
  });

  it('keeps orphan-combo-id items as flat (combo not in input)', () => {
    const rows = groupItemsByCombo({
      items: [item({ id: 'x', combo_id: 'missing' })],
      combos: [],
    });
    expect(rows).toEqual([{ kind: 'item', item: expect.objectContaining({ id: 'x' }) }]);
  });
});
