import { insforge } from '@/insforge/client';
import { aggregateAudit, type AuditAggregate } from '@/domain/audit';

export async function fetchAuditAggregate(periodId: string): Promise<AuditAggregate> {
  const [komandasRes, expensesRes, categoriesRes] = await Promise.all([
    // komanda_items doesn't store a subtotal; compute it client-side from
    // quantity * unit_price_cents (mirrors the rest of the app's totals math
    // in src/domain/total.ts). Inner-join the product so we can group by
    // category in the aggregate.
    insforge.database
      .from('komandas')
      .select(
        'id, status, payment_method, total_cents, opened_by_auth_user_id, ' +
          'items:komanda_items(quantity, unit_price_cents, combo_id, products(category)), ' +
          'combos:komanda_combos(id, category_snapshot, price_cents_snapshot)',
      )
      .eq('period_id', periodId),
    insforge.database
      .from('expenses')
      .select('id, amount_cents, paid_by, category_id, category_other_label, voided')
      .eq('period_id', periodId),
    insforge.database.from('expense_categories').select('id, name'),
  ]);
  if (komandasRes.error) throw komandasRes.error;
  if (expensesRes.error) throw expensesRes.error;
  if (categoriesRes.error) throw categoriesRes.error;

  const komandas = (komandasRes.data ?? []).map((k: any) => ({
    id: k.id,
    status: k.status,
    payment_method: k.payment_method,
    total_cents: k.total_cents,
    opened_by_auth_user_id: k.opened_by_auth_user_id,
    // Skip child items (combo_id != null) so their zero-price subtotal
    // doesn't appear under the products category. The combo price is
    // accounted for via the `combos` array below.
    items: (k.items ?? [])
      .filter((it: any) => it.combo_id == null)
      .map((it: any) => ({
        product_category: it.products?.category ?? 'Other',
        subtotal_cents: (it.quantity ?? 0) * (it.unit_price_cents ?? 0),
      })),
    combos: (k.combos ?? []).map((c: any) => ({
      id: c.id,
      category_snapshot: c.category_snapshot,
      price_cents_snapshot: c.price_cents_snapshot,
    })),
  }));

  return aggregateAudit({
    komandas,
    expenses: (expensesRes.data ?? []) as any,
    categories: (categoriesRes.data ?? []) as any,
  });
}
