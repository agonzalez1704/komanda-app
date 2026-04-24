import { useMemo, useState } from 'react';
import type { KomandaRowT } from '@/insforge/schemas';

export type FilterKey = 'all' | 'active' | 'closed';

export const KOMANDA_FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'all', label: 'All' },
  { key: 'closed', label: 'Closed' },
];

export type UseKomandasFilterResult = {
  filter: FilterKey;
  setFilter: (f: FilterKey) => void;
  search: string;
  setSearch: (s: string) => void;
  searchOpen: boolean;
  toggleSearch: () => void;
  filtered: KomandaRowT[];
};

export function useKomandasFilter(
  komandas: KomandaRowT[],
): UseKomandasFilterResult {
  const [filter, setFilter] = useState<FilterKey>('active');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  function toggleSearch() {
    setSearchOpen((v) => {
      if (v) setSearch('');
      return !v;
    });
  }

  const filtered = useMemo(() => {
    const byStatus =
      filter === 'all'
        ? komandas
        : filter === 'closed'
          ? komandas.filter((k) => k.status === 'closed')
          : komandas.filter((k) => k.status !== 'closed');
    const q = search.trim().toLowerCase();
    if (!q) return byStatus;
    return byStatus.filter((k) => {
      const number = (k.number ?? '').toLowerCase();
      const name = (k.display_name ?? '').toLowerCase();
      return number.includes(q) || name.includes(q);
    });
  }, [komandas, filter, search]);

  return {
    filter,
    setFilter,
    search,
    setSearch,
    searchOpen,
    toggleSearch,
    filtered,
  };
}
