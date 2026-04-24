import { useMemo } from 'react';
import type { KomandaRowT } from '@/insforge/schemas';
import type { KomandaStats } from './useKomandasData';

export type KomandaTotals = {
  all: number;
  active: number;
  closed: number;
  dayRevenue: number;
  itemsSold: number;
};

export function useKomandasTotals(
  komandas: KomandaRowT[],
  statsById: Map<string, KomandaStats>,
): KomandaTotals {
  return useMemo(() => {
    const t: KomandaTotals = {
      all: 0,
      active: 0,
      closed: 0,
      dayRevenue: 0,
      itemsSold: 0,
    };
    for (const k of komandas) {
      t.all += 1;
      if (k.status === 'closed') {
        t.closed += 1;
        t.dayRevenue += k.total_cents ?? 0;
        const s = statsById.get(k.id);
        if (s) t.itemsSold += s.count;
      } else {
        t.active += 1;
      }
    }
    return t;
  }, [komandas, statsById]);
}
