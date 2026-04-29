import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { useOnline } from './network';
import { drainQueue } from './processor';
import { handlers, queueStore } from './handlers';
import type { MutationType } from './queue';
import { ensureFreshAccessToken } from '@/insforge/refresh';

let draining = false;
let pending = false;
let qcRef: QueryClient | null = null;

/**
 * Maps a synced mutation type to the query keys whose data it could have
 * changed. Returning an empty array means the type doesn't affect any
 * cached query (none currently). Keys are passed as `predicate` matchers
 * so we invalidate the whole family (e.g. all per-komanda items caches),
 * not just one id.
 */
function affectedQueryKeys(types: Set<MutationType>): Array<(key: readonly unknown[]) => boolean> {
  const matchers: Array<(key: readonly unknown[]) => boolean> = [];

  const touchesKomandas =
    types.has('create_komanda') ||
    types.has('rename_komanda') ||
    types.has('update_status') ||
    types.has('close_komanda');
  if (touchesKomandas) {
    matchers.push((k) => k[0] === 'komandas');
    matchers.push((k) => k[0] === 'komanda');
  }

  const touchesItems =
    types.has('add_item') ||
    types.has('update_item') ||
    types.has('remove_item');
  if (touchesItems) {
    matchers.push((k) => k[0] === 'komanda' && k[2] === 'items');
  }

  const touchesMenu =
    types.has('upsert_product') ||
    types.has('delete_product') ||
    types.has('upsert_variant') ||
    types.has('delete_variant');
  if (touchesMenu) {
    matchers.push((k) => k[0] === 'products');
    matchers.push((k) => k[0] === 'variants');
  }

  if (types.has('upsert_modifier') || types.has('delete_modifier')) {
    matchers.push((k) => k[0] === 'modifiers');
  }

  return matchers;
}

async function runDrain() {
  if (!qcRef) return;
  if (draining) {
    pending = true;
    return;
  }
  draining = true;
  try {
    // The SDK's postgrest fetch (used for every db insert/select/RPC) reads
    // the access token from `tokenManager.getAccessToken()` and dispatches a
    // raw fetch — bypassing the HttpClient's auto-refresh-on-401 path. So
    // when an access token expires mid-session, every queued mutation 401s
    // until the user signs out and back in. Preflight here keeps the token
    // ahead of expiry so the drain itself doesn't surface "Invalid token".
    await ensureFreshAccessToken();
    const { synced } = await drainQueue(queueStore, handlers);
    if (synced.size > 0) {
      const matchers = affectedQueryKeys(synced);
      // If something synced but we couldn't map it (new mutation type
      // without a matcher), fall back to broad invalidation so the UI
      // never shows stale data after a successful write.
      if (matchers.length === 0) {
        await qcRef.invalidateQueries();
      } else {
        await Promise.all(
          matchers.map((predicate) => qcRef!.invalidateQueries({ predicate: (q) => predicate(q.queryKey) })),
        );
      }
    }
  } catch {
    // errors stored on mutations; nothing more to do here
  } finally {
    draining = false;
    if (pending) {
      pending = false;
      runDrain();
    }
  }
}

/** Trigger a drain from anywhere (e.g. right after enqueue). */
export function kickDrain() {
  runDrain();
}

export function useQueueDrain() {
  const online = useOnline();
  const qc = useQueryClient();
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    qcRef = qc;
  }, [qc]);

  useEffect(() => {
    if (online !== true) return;
    runDrain();
    ticker.current = setInterval(runDrain, 5000);
    return () => {
      if (ticker.current) clearInterval(ticker.current);
      ticker.current = null;
    };
  }, [online]);
}
