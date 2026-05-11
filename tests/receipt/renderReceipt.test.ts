import { renderReceipt } from '@/receipt/renderReceipt';

describe('renderReceipt', () => {
  it('produces HTML with org name, identifier, customer, items, total, and payment label', () => {
    const html = renderReceipt({
      orgName: 'Tacos El Güero',
      identifier: 'komanda-20260420-007',
      customerLabel: 'Mesa 4',
      waiterName: 'Juan',
      openedAtIso: '2026-04-20T14:32:00Z',
      closedAtIso: '2026-04-20T15:55:00Z',
      items: [
        {
          quantity: 2,
          product_name_snapshot: 'Taco',
          variant_name_snapshot: 'pastor',
          variant_2_name_snapshot: null,
          unit_price_cents: 2500,
          modifiers: [{ name_snapshot: 'sin cebolla' }],
          note_text: null,
        },
        {
          quantity: 1,
          product_name_snapshot: 'Coca-Cola',
          variant_name_snapshot: null,
          variant_2_name_snapshot: null,
          unit_price_cents: 3000,
          modifiers: [],
          note_text: null,
        },
      ],
      totalCents: 8000,
      paymentMethod: 'cash',
      bookingRef: '4F3A1B2C',
    });
    // Structural content — these are the load-bearing assertions.
    expect(html).toContain('Tacos El Güero');
    expect(html).toContain('komanda-20260420-007');
    expect(html).toContain('Mesa 4');
    expect(html).toContain('Juan');
    expect(html).toContain('Taco');
    expect(html).toContain('pastor');
    expect(html).toContain('sin cebolla');
    expect(html).toContain('$80.00');
    expect(html).toContain('Efectivo');
    expect(html).toContain('IVA incluido');
    // New ticket-style additions.
    expect(html).toContain('4F3A1B2C');
    expect(html).toContain('Order receipt');
  });

  it('renders combo header + indented children with combo price and no per-child money column', () => {
    const html = renderReceipt({
      orgName: 'Tacos El Güero',
      identifier: 'KOM-010',
      customerLabel: 'Mesa 7',
      waiterName: 'Juan',
      openedAtIso: '2026-04-20T14:32:00Z',
      closedAtIso: '2026-04-20T15:05:00Z',
      items: [
        {
          quantity: 1,
          product_name_snapshot: 'Agua mineral',
          variant_name_snapshot: null,
          variant_2_name_snapshot: null,
          unit_price_cents: 2500,
          modifiers: [],
          note_text: null,
        },
      ],
      combos: [
        {
          id: 'c1',
          name_snapshot: 'Combo Familiar',
          price_cents_snapshot: 6900,
          children: [
            {
              quantity: 3,
              product_name_snapshot: 'Taco',
              variant_name_snapshot: 'pastor',
              variant_2_name_snapshot: null,
              unit_price_cents: 0,
              modifiers: [{ name_snapshot: 'sin cebolla' }],
              note_text: null,
            },
            {
              quantity: 1,
              product_name_snapshot: 'Coca-Cola',
              variant_name_snapshot: null,
              variant_2_name_snapshot: null,
              unit_price_cents: 0,
              modifiers: [],
              note_text: null,
            },
          ],
        },
      ],
      totalCents: 9400,
      paymentMethod: 'cash',
      bookingRef: 'COMBO001',
    });
    // Combo header + price.
    expect(html).toContain('Combo Familiar');
    expect(html).toContain('$69.00');
    // Children rendered inside the combo block.
    expect(html).toContain('Taco');
    expect(html).toContain('Coca-Cola');
    expect(html).toContain('sin cebolla');
    // Free-floating item still renders with its line price.
    expect(html).toContain('Agua mineral');
    expect(html).toContain('$25.00');
    // The combo block container exists.
    expect(html).toContain('combo-children');
    expect(html).toContain('combo-header');
  });

  it('falls back to identifier as heading when customerLabel is null', () => {
    const html = renderReceipt({
      orgName: 'Org',
      identifier: 'KOM-001',
      customerLabel: null,
      waiterName: 'Ana',
      openedAtIso: '2026-04-20T14:32:00Z',
      closedAtIso: '2026-04-20T14:50:00Z',
      items: [],
      totalCents: 0,
      paymentMethod: 'card',
      bookingRef: 'AAAAAAAA',
    });
    expect(html).toContain('KOM-001');
    expect(html).toContain('Tarjeta');
  });
});
