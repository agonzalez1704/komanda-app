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

/**
 * Normalizes any thrown value to a readable string. Insforge (and most
 * PostgREST-style backends) reject with a plain object
 * `{ code, message, details, hint }`, which used to print as
 * "[object Object]" when string-coerced. We drill into common shapes first,
 * then fall back to JSON.
 */
export function formatError(e: unknown): string {
  if (e == null) return 'unknown';
  if (typeof e === 'string') return e;
  if (e instanceof Error) return e.message || e.name || 'Error';
  if (typeof e === 'object') {
    const o = e as Record<string, unknown>;
    // Insforge / PostgREST shape
    const code = typeof o.code === 'string' ? o.code : null;
    const msg =
      typeof o.message === 'string'
        ? o.message
        : typeof o.error === 'string'
          ? o.error
          : typeof o.details === 'string'
            ? o.details
            : null;
    if (msg) return code ? `${code}: ${msg}` : msg;
    // Nested { error: { message } }
    const inner = o.error;
    if (inner && typeof inner === 'object') {
      const nestedMsg = (inner as Record<string, unknown>).message;
      if (typeof nestedMsg === 'string') {
        return code ? `${code}: ${nestedMsg}` : nestedMsg;
      }
    }
    try {
      const json = JSON.stringify(o);
      if (json && json !== '{}') return json;
    } catch {
      /* circular — fall through */
    }
  }
  try {
    return String(e);
  } catch {
    return 'unknown';
  }
}

export interface DrainResult {
  /** Types of mutations that successfully synced this drain. */
  synced: Set<MutationType>;
}

export async function drainQueue(
  store: QueueStore,
  handlers: HandlerRegistry,
  opts: DrainOptions = {}
): Promise<DrainResult> {
  const maxAttempts = opts.maxAttempts ?? 5;
  const all = await getAll(store);
  const synced = new Set<MutationType>();

  for (const m of all) {
    if (m.attemptCount >= maxAttempts) continue;

    const handler = handlers[m.type];
    if (!handler) {
      await markFailed(store, m.id, `no_handler:${m.type}`);
      return { synced };
    }
    try {
      await handler(m);
      await dequeue(store, m.id);
      synced.add(m.type);
    } catch (e) {
      await markFailed(store, m.id, formatError(e));
      return { synced };
    }
  }

  return { synced };
}
