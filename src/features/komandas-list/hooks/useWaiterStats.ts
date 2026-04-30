import { useMemo } from 'react';
import type { KomandaRowT } from '@/insforge/schemas';
import type { KomandaStats } from './useKomandasData';

export type WaiterStats = {
  activeMine: number;
  oldestOpenAgeMs: number | null;
  closedToday: number;
  itemsAddedToday: number;
};

function isSameLocalDay(iso: string, day: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === day.getFullYear() &&
    d.getMonth() === day.getMonth() &&
    d.getDate() === day.getDate()
  );
}

export function useWaiterStats(
  komandas: KomandaRowT[],
  statsById: Map<string, KomandaStats>,
  today: Date,
  authUserId: string | null,
): WaiterStats {
  return useMemo(() => {
    const t: WaiterStats = {
      activeMine: 0,
      oldestOpenAgeMs: null,
      closedToday: 0,
      itemsAddedToday: 0,
    };
    if (!authUserId) return t;
    const now = today.getTime();

    for (const k of komandas) {
      if (k.opened_by_auth_user_id !== authUserId) continue;
      if (k.status === 'closed') {
        if (k.closed_at && isSameLocalDay(k.closed_at, today)) {
          t.closedToday += 1;
          const s = statsById.get(k.id);
          if (s) t.itemsAddedToday += s.count;
        }
      } else {
        t.activeMine += 1;
        const openedMs = new Date(k.opened_at).getTime();
        const age = now - openedMs;
        if (age > 0 && (t.oldestOpenAgeMs == null || age > t.oldestOpenAgeMs)) {
          t.oldestOpenAgeMs = age;
        }
      }
    }
    return t;
  }, [komandas, statsById, today, authUserId]);
}
