import {
  KomandaRow,
  OrganizationMemberRow,
  ProductRow,
  VariantRow,
  ModifierRow,
} from '@/insforge/schemas';

describe('KomandaRow', () => {
  it('accepts a well-formed row with null number', () => {
    const parsed = KomandaRow.parse({
      id: '11111111-1111-1111-a111-111111111111',
      org_id: '22222222-2222-4222-a222-222222222222',
      period_id: '55555555-5555-4555-a555-555555555555',
      number: null,
      display_name: null,
      status: 'open',
      opened_by_auth_user_id: '33333333-3333-4333-a333-333333333333',
      opened_at: '2026-04-20T14:32:00.000Z',
      closed_at: null,
      closed_by_auth_user_id: null,
      payment_method: null,
      total_cents: null,
      local_uuid: '44444444-4444-4444-a444-444444444444',
    });
    expect(parsed.status).toBe('open');
  });

  it('rejects an unknown status', () => {
    expect(() => KomandaRow.parse({ status: 'exploded' })).toThrow();
  });
});

describe('OrganizationMemberRow', () => {
  it('accepts admin/cashier/waiter/cook roles', () => {
    for (const role of ['admin', 'cashier', 'waiter', 'cook'] as const) {
      expect(
        OrganizationMemberRow.parse({
          id: '11111111-1111-4111-a111-111111111111',
          auth_user_id: '22222222-2222-4222-a222-222222222222',
          org_id: '33333333-3333-4333-a333-333333333333',
          role,
          display_name: 'Juan',
          created_at: '2026-04-20T00:00:00.000Z',
        }).role
      ).toBe(role);
    }
  });

  it('rejects legacy member role', () => {
    expect(() =>
      OrganizationMemberRow.parse({
        id: '11111111-1111-4111-a111-111111111111',
        auth_user_id: '22222222-2222-4222-a222-222222222222',
        org_id: '33333333-3333-4333-a333-333333333333',
        role: 'member',
        display_name: 'Juan',
        created_at: '2026-04-20T00:00:00.000Z',
      })
    ).toThrow();
  });
});

describe('ProductRow / VariantRow / ModifierRow', () => {
  it('parse active flags and integer prices', () => {
    ProductRow.parse({
      id: '11111111-1111-4111-a111-111111111111',
      org_id: '22222222-2222-4222-a222-222222222222',
      name: 'Taco',
      category: 'Tacos',
      price_cents: 2500,
      active: true,
      sort_order: 0,
      created_at: '2026-04-20T00:00:00.000Z',
    });
    VariantRow.parse({
      id: '11111111-1111-4111-a111-111111111111',
      product_id: '22222222-2222-4222-a222-222222222222',
      org_id: '33333333-3333-4333-a333-333333333333',
      name: 'pastor',
      active: true,
      sort_order: 0,
    });
    ModifierRow.parse({
      id: '11111111-1111-4111-a111-111111111111',
      org_id: '22222222-2222-4222-a222-222222222222',
      name: 'sin cebolla',
      active: true,
    });
  });
});
