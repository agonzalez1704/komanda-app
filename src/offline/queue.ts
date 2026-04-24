import AsyncStorage from '@react-native-async-storage/async-storage';
import { nanoid } from 'nanoid/non-secure';

export const QUEUE_STORAGE_KEY = '@komanda/mutation-queue/v1';

export type MutationType =
  | 'create_komanda'
  | 'rename_komanda'
  | 'update_status'
  | 'add_item'
  | 'update_item'
  | 'remove_item'
  | 'close_komanda'
  | 'upsert_product'
  | 'delete_product'
  | 'upsert_variant'
  | 'delete_variant'
  | 'upsert_modifier'
  | 'delete_modifier';

export interface QueuedMutation<P = unknown> {
  id: string;
  type: MutationType;
  payload: P;
  createdAt: string;
  attemptCount: number;
  lastError: string | null;
}

export interface QueueStore {
  read: () => Promise<QueuedMutation[]>;
  write: (next: QueuedMutation[]) => Promise<void>;
  snapshot: () => QueuedMutation[];
}

export function createQueueStore(): QueueStore {
  let memo: QueuedMutation[] = [];
  let hydrated = false;
  const hydrate = (async () => {
    const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    memo = raw ? (JSON.parse(raw) as QueuedMutation[]) : [];
    hydrated = true;
  })();

  return {
    async read() {
      if (!hydrated) await hydrate;
      return memo;
    },
    async write(next) {
      memo = next;
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(next));
    },
    snapshot() {
      return memo;
    },
  };
}

export async function enqueue<P>(
  store: QueueStore,
  input: { type: MutationType; payload: P }
): Promise<QueuedMutation<P>> {
  const all = await store.read();
  const next: QueuedMutation<P> = {
    id: nanoid(),
    type: input.type,
    payload: input.payload,
    createdAt: new Date().toISOString(),
    attemptCount: 0,
    lastError: null,
  };
  await store.write([...all, next as QueuedMutation]);
  return next;
}

export async function dequeue(store: QueueStore, id: string): Promise<void> {
  const all = await store.read();
  await store.write(all.filter((m) => m.id !== id));
}

export async function markFailed(
  store: QueueStore,
  id: string,
  error: string
): Promise<void> {
  const all = await store.read();
  const next = all.map((m) =>
    m.id === id ? { ...m, attemptCount: m.attemptCount + 1, lastError: error } : m
  );
  await store.write(next);
}

export async function getAll(store: QueueStore): Promise<QueuedMutation[]> {
  return store.read();
}

/**
 * Resets attempt counters for the given ids (or all entries if omitted) so
 * the processor will pick them up again. Used by the "Retry now" action on
 * the stuck-mutations banner after a transient failure.
 */
export async function resetAttempts(
  store: QueueStore,
  ids?: string[],
): Promise<void> {
  const all = await store.read();
  const idSet = ids ? new Set(ids) : null;
  const next = all.map((m) =>
    !idSet || idSet.has(m.id) ? { ...m, attemptCount: 0, lastError: null } : m,
  );
  await store.write(next);
}
