import { useState } from 'react';

/**
 * Tracks manual pull-to-refresh separately from useQuery's `isRefetching`
 * so background refetches (offline drain invalidation, window focus, etc.)
 * don't flash the spinner on every tick.
 */
export function usePullRefresh(refetch: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  async function onRefresh() {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }
  return { refreshing, onRefresh };
}
