import type { QueueStore } from '@/offline/queue';

/**
 * Sentinel thrown by a handler when it cannot run yet because a producer
 * mutation it depends on hasn't synced. The processor catches this and
 * skips the mutation without incrementing its attempt counter — we'll
 * pick it up again on a later drain.
 */
export class DeferredMutationError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'DeferredMutationError';
  }
}

/**
 * Returns the set of local-uuids that ARE produced by some queued mutation:
 *   - `create_komanda` produces `payload.local_uuid` (komanda's local id)
 *   - `add_item` produces `payload.item_local_uuid` (item's local id)
 * If a dependent mutation references one of these AND the localStore has
 * no server mapping yet, running it would FK-fail; we defer instead.
 */
export async function getQueuedProducerIds(store: QueueStore): Promise<Set<string>> {
  const all = await store.read();
  const out = new Set<string>();
  for (const m of all) {
    if (m.type === 'create_komanda') {
      const lu = (m.payload as { local_uuid?: unknown }).local_uuid;
      if (typeof lu === 'string') out.add(lu);
    } else if (m.type === 'add_item') {
      const lu = (m.payload as { item_local_uuid?: unknown }).item_local_uuid;
      if (typeof lu === 'string') out.add(lu);
    }
  }
  return out;
}
