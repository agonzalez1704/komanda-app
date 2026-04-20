import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createQueueStore,
  enqueue,
  getAll,
  type QueuedMutation,
} from '@/offline/queue';
import { drainQueue, type MutationHandler } from '@/offline/processor';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('drainQueue', () => {
  it('processes mutations FIFO and removes them on success', async () => {
    const store = createQueueStore();
    const order: string[] = [];
    const handler: MutationHandler = async (m: QueuedMutation) => {
      order.push(String((m.payload as any).tag));
    };

    await enqueue(store, { type: 'create_komanda', payload: { tag: 'a' } });
    await enqueue(store, { type: 'add_item', payload: { tag: 'b' } });

    await drainQueue(store, { create_komanda: handler, add_item: handler } as any);

    expect(order).toEqual(['a', 'b']);
    expect(await getAll(store)).toEqual([]);
  });

  it('increments attemptCount on transient failure and stops the drain', async () => {
    const store = createQueueStore();
    await enqueue(store, { type: 'create_komanda', payload: { tag: 'a' } });
    await enqueue(store, { type: 'create_komanda', payload: { tag: 'b' } });

    const failing: MutationHandler = async () => {
      throw new Error('network');
    };
    await drainQueue(store, { create_komanda: failing } as any);

    const remaining = await getAll(store);
    expect(remaining).toHaveLength(2);
    expect(remaining[0].attemptCount).toBe(1);
    expect(remaining[0].lastError).toBe('network');
    expect(remaining[1].attemptCount).toBe(0);
  });

  it('skips mutations that exceed maxAttempts', async () => {
    await AsyncStorage.setItem(
      '@komanda/mutation-queue/v1',
      JSON.stringify([
        {
          id: 'stuck',
          type: 'create_komanda',
          payload: {},
          createdAt: '2026-04-20T00:00:00.000Z',
          attemptCount: 5,
          lastError: 'boom',
        },
      ])
    );
    const store = createQueueStore();
    await new Promise((r) => setTimeout(r, 0));

    const failing: MutationHandler = async () => {
      throw new Error('still broken');
    };
    await drainQueue(store, { create_komanda: failing } as any, { maxAttempts: 5 });

    const remaining = await getAll(store);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].attemptCount).toBe(5);
  });
});
