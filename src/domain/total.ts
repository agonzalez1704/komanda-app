export interface PricedItem {
  quantity: number;
  unit_price_cents: number;
}

export function calculateTotal(items: PricedItem[]): number {
  let total = 0;
  for (const item of items) {
    total += item.quantity * item.unit_price_cents;
  }
  return total;
}
