import type { FilterKey } from '../hooks/useKomandasFilter';

export function emptyTitleFor(filter: FilterKey, total: number): string {
  if (total === 0) return 'No komandas yet today';
  if (filter === 'closed') return 'Nothing closed yet';
  if (filter === 'active') return 'All caught up';
  return 'No komandas match';
}

export function emptySubtitleFor(filter: FilterKey, total: number): string {
  if (total === 0) return 'Tap the button below to open your first order.';
  if (filter === 'closed') return 'Close a komanda to see it appear here.';
  if (filter === 'active') return 'Every komanda has been closed. Nice work.';
  return 'Try a different filter or open a new komanda.';
}
