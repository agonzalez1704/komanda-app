import { KomandaCard } from '@/components/KomandaCard';
import type { KomandaRowT } from '@/insforge/schemas';
import type { KomandaStats } from '../hooks/useKomandasData';

/**
 * Thin wrapper around KomandaCard that owns the navigation side-effect.
 * Isolating the push here gives the tap-handler a single, predictable
 * breakpoint / log target and keeps the screen composition declarative.
 */
export function KomandaListItem({
  komanda,
  stats,
  onOpen,
}: {
  komanda: KomandaRowT;
  stats: KomandaStats;
  onOpen: (k: KomandaRowT) => void;
}) {
  const running =
    komanda.status === 'closed'
      ? komanda.total_cents ?? stats.total
      : stats.total;
  return (
    <KomandaCard
      k={komanda}
      itemCount={stats.count}
      runningTotalCents={running}
      syncedServerSide={komanda.number !== null}
      onPress={() => {
        console.log('[KomandaListItem] open ->', komanda.id);
        onOpen(komanda);
      }}
    />
  );
}
