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

/**
 * Waiter-mode hero card stats. closedToday / itemsAddedToday now scope to
 * either the open audit period (default) or a specific selected calendar
 * day — same shift-aware logic as useKomandasTotals so the card doesn't
 * zero-out at midnight on a long shift.
 */
export function useWaiterStats(
  komandas: KomandaRowT[],
  statsById: Map<string, KomandaStats>,
  args: { openPeriodId: string | null; selectedDate: Date | null; now: Date },
  authUserId: string | null,
): WaiterStats {
  const { openPeriodId, selectedDate, now } = args;
  return useMemo(() => {
    const t: WaiterStats = {
      activeMine: 0,
      oldestOpenAgeMs: null,
      closedToday: 0,
      itemsAddedToday: 0,
    };
    if (!authUserId) return t;
    const nowMs = now.getTime();

    for (const k of komandas) {
      if (k.opened_by_auth_user_id !== authUserId) continue;
      if (k.status === 'closed') {
        const inShift = selectedDate
          ? k.closed_at != null && isSameLocalDay(k.closed_at, selectedDate)
          : openPeriodId != null && k.period_id === openPeriodId;
        if (inShift) {
          t.closedToday += 1;
          const s = statsById.get(k.id);
          if (s) t.itemsAddedToday += s.count;
        }
      } else {
        t.activeMine += 1;
        const openedMs = new Date(k.opened_at).getTime();
        const age = nowMs - openedMs;
        if (age > 0 && (t.oldestOpenAgeMs == null || age > t.oldestOpenAgeMs)) {
          t.oldestOpenAgeMs = age;
        }
      }
    }
    return t;
  }, [komandas, statsById, openPeriodId, selectedDate, now, authUserId]);
}
