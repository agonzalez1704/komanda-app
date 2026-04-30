import { formatMXN } from '@/domain/money';
import type { PaymentMethodT } from '@/insforge/schemas';

export interface ReceiptItem {
  quantity: number;
  product_name_snapshot: string;
  variant_name_snapshot: string | null;
  unit_price_cents: number;
  modifiers: { name_snapshot: string }[];
  note_text: string | null;
}

export interface ReceiptData {
  orgName: string;
  identifier: string;
  /** Optional customer label (komanda.display_name). */
  customerLabel?: string | null;
  waiterName: string;
  openedAtIso: string;
  /** Optional. When omitted, current time is used (e.g. close-flow snapshot). */
  closedAtIso?: string | null;
  items: ReceiptItem[];
  totalCents: number;
  paymentMethod: PaymentMethodT;
  /** Short, deterministic id (e.g. komanda.id.split('-')[0].toUpperCase()). */
  bookingRef: string;
}

const PAYMENT_ES: Record<PaymentMethodT, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
};

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      default: return '&#39;';
    }
  });
}

export function renderReceipt(d: ReceiptData): string {
  const dt = new Date(d.openedAtIso);
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;

  const itemRows = d.items
    .map((it) => {
      const name = `${esc(it.product_name_snapshot)}${it.variant_name_snapshot ? ` (${esc(it.variant_name_snapshot)})` : ''}`;
      const mods = it.modifiers.map((m) => `<div class="mod">· ${esc(m.name_snapshot)}</div>`).join('');
      const note = it.note_text ? `<div class="note">${esc(it.note_text)}</div>` : '';
      const line = formatMXN(it.quantity * it.unit_price_cents);
      return `
        <tr>
          <td class="qty">${it.quantity}</td>
          <td class="name">${name}${mods}${note}</td>
          <td class="line">${line}</td>
        </tr>`;
    })
    .join('');

  const heading = d.customerLabel && d.customerLabel.length > 0 ? d.customerLabel : d.orgName;

  return `<!doctype html>
<html><head><meta charset="utf-8"/><style>
  @page { margin: 0; size: 80mm auto; }
  body { font-family: "Courier New", monospace; font-size: 12px; color: #111; margin: 0; padding: 12px; width: 80mm; box-sizing: border-box; }
  h1 { font-size: 14px; margin: 0 0 4px; text-align: center; }
  .meta { display: flex; justify-content: space-between; font-size: 11px; margin: 6px 0; }
  hr { border: none; border-top: 1px dashed #444; margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 2px 0; vertical-align: top; }
  .qty { width: 22px; }
  .line { text-align: right; white-space: nowrap; }
  .mod, .note { font-size: 10px; color: #555; margin-left: 6px; }
  .totals { display: flex; justify-content: space-between; font-weight: 700; font-size: 13px; margin-top: 6px; }
  .iva { font-size: 10px; text-align: right; color: #555; }
  .pay { margin-top: 4px; font-size: 12px; }
  .ref { margin-top: 4px; font-size: 11px; }
  .thanks { text-align: center; margin-top: 10px; }
</style></head>
<body>
  <h1>${esc(heading)}</h1>
  <div class="meta">
    <span>${esc(d.orgName)}</span>
    <span>${esc(stamp)}</span>
  </div>
  <div class="meta">
    <span>${esc(d.identifier)}</span>
  </div>
  <div>Atendió: ${esc(d.waiterName)}</div>
  <hr/>
  <table>${itemRows}</table>
  <hr/>
  <div class="totals"><span>TOTAL</span><span>${formatMXN(d.totalCents)}</span></div>
  <div class="iva">IVA incluido</div>
  <div class="pay">Pago: ${PAYMENT_ES[d.paymentMethod]}</div>
  <div class="ref">Booking: ${esc(d.bookingRef)}</div>
  <hr/>
  <div class="thanks">¡Gracias por su visita!</div>
</body></html>`;
}
