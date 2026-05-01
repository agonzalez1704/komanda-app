import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import type { KomandaRowT } from '@/insforge/schemas';
import {
  fetchItemsForKomanda,
  fetchKomandas,
} from '@/insforge/queries/komandas';
import { calculateTotal } from '@/domain/total';

export type KomandaStats = { count: number; total: number };

export type UseKomandasDataResult = {
  komandas: KomandaRowT[];
  isLoading: boolean;
  refetch: () => Promise<unknown>;
  statsById: Map<string, KomandaStats>;
};

export function useKomandasData(): UseKomandasDataResult {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['komandas', 'all'],
    queryFn: fetchKomandas,
    staleTime: 1000 * 10,
  });

  const komandas = data ?? [];

  const itemQueries = useQueries({
    queries: komandas.map((k) => ({
      queryKey: ['komanda', k.id, 'items'],
      queryFn: () => fetchItemsForKomanda(k.id),
      enabled: k.number !== null,
      staleTime: 1000 * 10,
    })),
  });

  const statsById = useMemo(() => {
    const m = new Map<string, KomandaStats>();
    komandas.forEach((k, idx) => {
      const items = itemQueries[idx]?.data ?? [];
      const count = items.reduce((acc, it) => acc + it.quantity, 0);
      m.set(k.id, { count, total: calculateTotal(items) });
    });
    return m;
  }, [komandas, itemQueries]);

  return { komandas, isLoading, refetch, statsById };
}
