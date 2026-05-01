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

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatStamp(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
  };
}

function durationLabel(openedIso: string, closedIso: string): string {
  const totalMin = Math.max(
    0,
    Math.floor((new Date(closedIso).getTime() - new Date(openedIso).getTime()) / 60_000),
  );
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${pad2(m)}m`;
}

/**
 * Mirrors barcodeBars from KomandaTicket so the printed receipt matches the
 * in-app ticket footer. Bars are emitted as inline-styled spans (no SVG dep).
 */
function barcodeSpans(seed: string): string {
  const safe = seed.length > 0 ? seed : 'KOMANDA';
  let out = '';
  for (let i = 0; i < 36; i++) {
    const c = safe.charCodeAt(i % safe.length) ?? 33;
    const w = 1 + (c % 4);
    const h = 28 + (c % 16);
    out += `<span style="display:inline-block;width:${w}px;height:${h}px;background:#1C1410;margin-right:1px;vertical-align:bottom;"></span>`;
  }
  return out;
}

export function renderReceipt(d: ReceiptData): string {
  const closedIso = d.closedAtIso ?? new Date().toISOString();
  const opened = formatStamp(d.openedAtIso);
  const closed = formatStamp(closedIso);
  const dur = durationLabel(d.openedAtIso, closedIso);

  const heading = d.customerLabel && d.customerLabel.length > 0 ? d.customerLabel : d.identifier;

  const itemRows = d.items
    .map((it) => {
      const name = `${esc(it.product_name_snapshot)}${it.variant_name_snapshot ? ` · ${esc(it.variant_name_snapshot)}` : ''}`;
      const mods = it.modifiers.length > 0
        ? `<div class="sub">${it.modifiers.map((m) => esc(m.name_snapshot)).join(' · ')}</div>`
        : '';
      const note = it.note_text ? `<div class="sub note">“${esc(it.note_text)}”</div>` : '';
      const line = formatMXN(it.quantity * it.unit_price_cents);
      return `
        <div class="item">
          <div class="item-main">
            <div class="item-name"><span class="qty">${it.quantity}× </span>${name}</div>
            ${mods}${note}
          </div>
          <div class="item-price">${line}</div>
        </div>`;
    })
    .join('');

  return `<!doctype html>
<html><head><meta charset="utf-8"/><style>
  @page { margin: 0; size: A6 portrait; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Helvetica Neue", Arial, sans-serif;
    color: #1C1410;
    margin: 0;
    padding: 12px;
    background: #FBF6EF;
  }
  .card {
    background: #FBF6EF;
    border: 1px solid #ECE4DA;
    border-radius: 18px;
    padding: 20px 18px 0;
    overflow: hidden;
  }
  .eyebrow {
    font-size: 9px;
    font-weight: 700;
    color: #C8811E;
    text-transform: uppercase;
    letter-spacing: 1.6px;
    margin: 0;
  }
  .heading {
    margin: 4px 0 2px;
    font-size: 20px;
    font-weight: 800;
    color: #1C1410;
    letter-spacing: -0.3px;
    line-height: 1.15;
  }
  .subhead {
    font-size: 10px;
    color: #6B5B4C;
    margin-bottom: 14px;
  }
  .time-strip {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 0;
    border-top: 1px solid #ECE4DA;
    border-bottom: 1px solid #ECE4DA;
  }
  .time-col { min-width: 60px; }
  .time-col.right { text-align: right; margin-left: auto; }
  .time-label {
    font-size: 8px;
    font-weight: 700;
    color: #8A7A6B;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .time-value {
    font-size: 14px;
    font-weight: 700;
    color: #1C1410;
    font-variant-numeric: tabular-nums;
  }
  .time-meta { font-size: 9px; color: #8A7A6B; }
  .time-mid {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
  .time-rule { flex: 1; height: 1px; background: #D9CEBF; }
  .time-dur {
    font-size: 9px;
    font-weight: 600;
    color: #C8811E;
    text-transform: uppercase;
    letter-spacing: 0.8px;
  }
  .items { padding: 12px 0; }
  .item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 6px 0;
  }
  .item-main { flex: 1; }
  .item-name {
    font-size: 12px;
    color: #1C1410;
    line-height: 1.35;
  }
  .qty { color: #C8811E; font-weight: 700; }
  .sub {
    font-size: 10px;
    color: #6B5B4C;
    margin-left: 14px;
    margin-top: 2px;
  }
  .note { font-style: italic; }
  .item-price {
    font-size: 12px;
    font-weight: 600;
    color: #1C1410;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .meta-strip {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding-top: 10px;
    border-top: 1px solid #ECE4DA;
  }
  .meta-col { flex: 1; }
  .meta-col.center { text-align: center; }
  .meta-col.right { text-align: right; }
  .meta-label {
    font-size: 8px;
    font-weight: 700;
    color: #8A7A6B;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .meta-value {
    font-size: 12px;
    font-weight: 600;
    color: #1C1410;
  }
  .total-block {
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid #ECE4DA;
  }
  .total-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }
  .total-label {
    font-size: 11px;
    font-weight: 600;
    color: #6B5B4C;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .total-value {
    font-size: 22px;
    font-weight: 800;
    color: #1C1410;
    letter-spacing: -0.3px;
    font-variant-numeric: tabular-nums;
  }
  .total-caption {
    font-size: 9px;
    color: #8A7A6B;
    text-align: right;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .barcode-band {
    margin: 14px -18px 0;
    padding: 14px 18px;
    background: #F5EDE1;
    text-align: center;
  }
  .barcode-row {
    line-height: 0;
    margin-bottom: 6px;
  }
  .barcode-ref {
    font-family: "Courier New", monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 2px;
    color: #1C1410;
  }
</style></head>
<body>
  <div class="card">
    <div class="eyebrow">Order receipt</div>
    <div class="heading">${esc(heading)}</div>
    <div class="subhead">${esc(d.orgName)} · #${esc(d.identifier)}</div>

    <div class="time-strip">
      <div class="time-col">
        <div class="time-label">Opened</div>
        <div class="time-value">${opened.time}</div>
        <div class="time-meta">${opened.date}</div>
      </div>
      <div class="time-mid">
        <div class="time-rule"></div>
        <div class="time-dur">${dur}</div>
        <div class="time-rule"></div>
      </div>
      <div class="time-col right">
        <div class="time-label">Closed</div>
        <div class="time-value">${closed.time}</div>
        <div class="time-meta">${closed.date}</div>
      </div>
    </div>

    <div class="items">${itemRows}</div>

    <div class="meta-strip">
      <div class="meta-col">
        <div class="meta-label">Booking</div>
        <div class="meta-value">${esc(d.bookingRef)}</div>
      </div>
      <div class="meta-col center">
        <div class="meta-label">Atendió</div>
        <div class="meta-value">${esc(d.waiterName)}</div>
      </div>
      <div class="meta-col right">
        <div class="meta-label">Pago</div>
        <div class="meta-value">${PAYMENT_ES[d.paymentMethod]}</div>
      </div>
    </div>

    <div class="total-block">
      <div class="total-row">
        <span class="total-label">Total</span>
        <span class="total-value">${formatMXN(d.totalCents)}</span>
      </div>
      <div class="total-caption">IVA incluido</div>
    </div>

    <div class="barcode-band">
      <div class="barcode-row">${barcodeSpans(d.bookingRef)}</div>
      <div class="barcode-ref">${esc(d.bookingRef)}</div>
    </div>
  </div>
</body></html>`;
}
