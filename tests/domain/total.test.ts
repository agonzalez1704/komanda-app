import { calculateTotal } from '@/domain/total';

describe('calculateTotal', () => {
  it('returns 0 for an empty komanda', () => {
    expect(calculateTotal([])).toBe(0);
  });
  it('sums qty × unit_price_cents across items', () => {
    expect(
      calculateTotal([
        { quantity: 2, unit_price_cents: 2500 },
        { quantity: 1, unit_price_cents: 3000 },
        { quantity: 3, unit_price_cents: 1000 },
      ])
    ).toBe(11000);
  });
  it('ignores modifier and note fields (they do not affect price in v1)', () => {
    expect(
      calculateTotal([
        {
          quantity: 1,
          unit_price_cents: 2500,
          note_text: 'no cilantro',
          modifiers: [{ name_snapshot: 'extra salsa' }],
        } as any,
      ])
    ).toBe(2500);
  });
});
