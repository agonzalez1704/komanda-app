import type { KomandaRowT } from '@/insforge/schemas';
import { formatDateLong } from './formatDateLong';

export type KomandaSection = {
  key: string;
  title: string;
  data: KomandaRowT[];
};

function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const CURRENT_SHIFT_KEY = '__current_shift__';

function dayLabel(dayKey: string, today: Date): string {
  const todayKey = localDayKey(today);
  if (dayKey === todayKey) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dayKey === localDayKey(yesterday)) return 'Yesterday';
  const [y, m, d] = dayKey.split('-').map(Number);
  return formatDateLong(new Date(y, m - 1, d));
}

/**
 * Group komandas into sections.
 *
 *   - When `openPeriodId` is provided, every komanda whose period_id matches
 *     collapses into a single "Current shift" section regardless of the
 *     local clock day. Avoids splitting a past-midnight shift across
 *     "Today" and "Yesterday" headers.
 *   - All other rows group by local day of opened_at.
 *   - Komandas already arrive ordered desc by opened_at from the server,
 *     so iteration order is naturally newest-first.
 */
export function groupKomandasByDay(
  komandas: KomandaRowT[],
  today: Date,
  openPeriodId: string | null = null,
): KomandaSection[] {
  const buckets = new Map<string, KomandaRowT[]>();
  const order: string[] = [];
  for (const k of komandas) {
    const key =
      openPeriodId != null && k.period_id === openPeriodId
        ? CURRENT_SHIFT_KEY
        : localDayKey(new Date(k.opened_at));
    let arr = buckets.get(key);
    if (!arr) {
      arr = [];
      buckets.set(key, arr);
      order.push(key);
    }
    arr.push(k);
  }
  return order.map((key) => ({
    key,
    title: key === CURRENT_SHIFT_KEY ? 'Current shift' : dayLabel(key, today),
    data: buckets.get(key)!,
  }));
}
