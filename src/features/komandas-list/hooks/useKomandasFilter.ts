import { useMemo, useState } from 'react';
import type { KomandaRowT } from '@/insforge/schemas';

export type FilterKey = 'all' | 'active' | 'closed';

export const KOMANDA_FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'all', label: 'All' },
  { key: 'closed', label: 'Closed' },
];

function isSameLocalDay(iso: string, day: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === day.getFullYear() &&
    d.getMonth() === day.getMonth() &&
    d.getDate() === day.getDate()
  );
}

export type UseKomandasFilterResult = {
  filter: FilterKey;
  setFilter: (f: FilterKey) => void;
  search: string;
  setSearch: (s: string) => void;
  searchOpen: boolean;
  toggleSearch: () => void;
  /** null = current shift (open period). Date = specific calendar day. */
  selectedDate: Date | null;
  setSelectedDate: (d: Date | null) => void;
  filtered: KomandaRowT[];
};

/**
 * Filtering pipeline:
 *   1. Date scope — current shift (open period) by default, or a specific
 *      calendar day if the user picks one.
 *   2. Status filter (active/closed/all).
 *   3. Search by number / display_name.
 *
 * Shift scoping uses period_id (server-assigned), not clock, so a komanda
 * opened at 11:30 PM and closed at 12:30 AM stays in "current shift" until
 * the admin actually closes the period.
 */
export function useKomandasFilter(
  komandas: KomandaRowT[],
  args: { openPeriodId: string | null },
): UseKomandasFilterResult {
  const [filter, setFilter] = useState<FilterKey>('active');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const { openPeriodId } = args;

  function toggleSearch() {
    setSearchOpen((v) => {
      if (v) setSearch('');
      return !v;
    });
  }

  const filtered = useMemo(() => {
    // Step 1 — scope by date.
    const byDate = selectedDate
      ? komandas.filter((k) => {
          // Closed komanda lives on its closed_at day (money landed then);
          // open komanda lives on its opened_at day so the user can browse
          // yesterday's still-open tables too.
          const ref = k.status === 'closed' ? k.closed_at : k.opened_at;
          return ref != null && isSameLocalDay(ref, selectedDate);
        })
      : openPeriodId != null
        ? komandas.filter(
            (k) => k.status !== 'closed' || k.period_id === openPeriodId,
          )
        : komandas;

    // Step 2 — status filter.
    const byStatus =
      filter === 'all'
        ? byDate
        : filter === 'closed'
          ? byDate.filter((k) => k.status === 'closed')
          : byDate.filter((k) => k.status !== 'closed');

    // Step 3 — search.
    const q = search.trim().toLowerCase();
    if (!q) return byStatus;
    return byStatus.filter((k) => {
      const number = (k.number ?? '').toLowerCase();
      const name = (k.display_name ?? '').toLowerCase();
      return number.includes(q) || name.includes(q);
    });
  }, [komandas, filter, search, selectedDate, openPeriodId]);

  return {
    filter,
    setFilter,
    search,
    setSearch,
    searchOpen,
    toggleSearch,
    selectedDate,
    setSelectedDate,
    filtered,
  };
}
