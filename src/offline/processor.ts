import {
  dequeue,
  getAll,
  markFailed,
  type QueuedMutation,
  type QueueStore,
  type MutationType,
} from './queue';

export type MutationHandler = (m: QueuedMutation) => Promise<void>;
export type HandlerRegistry = Record<MutationType, MutationHandler>;

export interface DrainOptions {
  maxAttempts?: number;
}

export async function drainQueue(
  store: QueueStore,
  handlers: HandlerRegistry,
  opts: DrainOptions = {}
): Promise<void> {
  const maxAttempts = opts.maxAttempts ?? 5;
  const all = await getAll(store);

  for (const m of all) {
    if (m.attemptCount >= maxAttempts) continue;

    const handler = handlers[m.type];
    if (!handler) {
      await markFailed(store, m.id, `no_handler:${m.type}`);
      return;
    }
    try {
      await handler(m);
      await dequeue(store, m.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await markFailed(store, m.id, msg);
      return;
    }
  }
}
