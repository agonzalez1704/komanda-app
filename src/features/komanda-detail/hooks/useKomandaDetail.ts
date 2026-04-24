import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchItemsForKomanda,
  fetchKomandaById,
  type KomandaItemRowT,
  type KomandaItemModifierRowT,
} from '@/insforge/queries/komandas';
import type { KomandaRowT } from '@/insforge/schemas';

export type KomandaItemWithMods = KomandaItemRowT & {
  modifiers: KomandaItemModifierRowT[];
};

export type UseKomandaDetailResult = {
  row: KomandaRowT | null;
  items: KomandaItemWithMods[];
  isLoading: boolean;
  isMissing: boolean;
};

/**
 * Loads a single komanda + its items, with a cache-first fallback for
 * optimistic/offline-only rows that haven't been assigned a server-side
 * `number` yet. Those rows come from the list's pre-seeded query cache and
 * should render without a network round-trip.
 */
export function useKomandaDetail(id: string | undefined): UseKomandaDetailResult {
  const qc = useQueryClient();
  const cached = id ? qc.getQueryData<KomandaRowT>(['komanda', id]) : undefined;
  const localOnly = cached != null && cached.number === null;

  const komanda = useQuery({
    queryKey: ['komanda', id],
    queryFn: () => fetchKomandaById(id!),
    enabled: !!id && !localOnly,
  });

  const items = useQuery({
    queryKey: ['komanda', id, 'items'],
    queryFn: () => fetchItemsForKomanda(id!),
    enabled: !!id && !localOnly,
  });

  const row: KomandaRowT | null = (komanda.data ?? cached) ?? null;
  const isLoading = !id || (komanda.isLoading && !cached);
  const isMissing = !isLoading && !row;

  return {
    row,
    items: items.data ?? [],
    isLoading,
    isMissing,
  };
}
