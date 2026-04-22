import { renderReceipt } from '@/receipt/renderReceipt';

describe('renderReceipt', () => {
  it('produces HTML with org name, identifier, items, total, and payment label', () => {
    const html = renderReceipt({
      orgName: 'Tacos El Güero',
      identifier: 'komanda-20260420-007',
      waiterName: 'Juan',
      openedAtIso: '2026-04-20T14:32:00Z',
      items: [
        {
          quantity: 2,
          product_name_snapshot: 'Taco',
          variant_name_snapshot: 'pastor',
          unit_price_cents: 2500,
          modifiers: [{ name_snapshot: 'sin cebolla' }],
          note_text: null,
        },
        {
          quantity: 1,
          product_name_snapshot: 'Coca-Cola',
          variant_name_snapshot: null,
          unit_price_cents: 3000,
          modifiers: [],
          note_text: null,
        },
      ],
      totalCents: 8000,
      paymentMethod: 'cash',
    });
    expect(html).toContain('Tacos El Güero');
    expect(html).toContain('komanda-20260420-007');
    expect(html).toContain('Juan');
    expect(html).toContain('Taco');
    expect(html).toContain('pastor');
    expect(html).toContain('sin cebolla');
    expect(html).toContain('$80.00');
    expect(html).toContain('Efectivo');
    expect(html).toContain('IVA incluido');
  });
});
