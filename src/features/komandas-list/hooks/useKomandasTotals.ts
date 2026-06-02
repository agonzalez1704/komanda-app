import { useMemo } from 'react';
import type { KomandaRowT } from '@/insforge/schemas';
import type { KomandaStats } from './useKomandasData';

export type KomandaTotals = {
  all: number;
  active: number;
  closed: number;
  dayClosed: number;
  dayRevenue: number;
  itemsSold: number;
};

function isSameLocalDay(iso: string, day: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === day.getFullYear() &&
    d.getMonth() === day.getMonth() &&
    d.getDate() === day.getDate()
  );
}

/**
 * Totals for the stats card + filter bar.
 *
 *   all / active / closed: scoped to whatever the list is currently showing
 *   (after dateFilter, before status filter).
 *   dayClosed / dayRevenue / itemsSold: "shift revenue" — when a date is
 *   selected, sum closed komandas on that calendar day; otherwise sum
 *   closed komandas in the open period (period_id match), which is what we
 *   want at 12:30 AM when the shift hasn't been reconciled yet.
 */
export function useKomandasTotals(
  komandas: KomandaRowT[],
  statsById: Map<string, KomandaStats>,
  args: { openPeriodId: string | null; selectedDate: Date | null },
): KomandaTotals {
  const { openPeriodId, selectedDate } = args;
  return useMemo(() => {
    const t: KomandaTotals = {
      all: 0,
      active: 0,
      closed: 0,
      dayClosed: 0,
      dayRevenue: 0,
      itemsSold: 0,
    };
    for (const k of komandas) {
      t.all += 1;
      if (k.status === 'closed') {
        t.closed += 1;
        const inShift = selectedDate
          ? k.closed_at != null && isSameLocalDay(k.closed_at, selectedDate)
          : openPeriodId != null && k.period_id === openPeriodId;
        if (inShift) {
          t.dayClosed += 1;
          t.dayRevenue += k.total_cents ?? 0;
          const s = statsById.get(k.id);
          if (s) t.itemsSold += s.count;
        }
      } else {
        t.active += 1;
      }
    }
    return t;
  }, [komandas, statsById, openPeriodId, selectedDate]);
}
