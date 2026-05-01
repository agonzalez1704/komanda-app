jest.mock('@react-native-async-storage/async-storage');

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createQueueStore,
  enqueue,
  dequeue,
  dequeueWithDependents,
  markFailed,
  getAll,
  QUEUE_STORAGE_KEY,
} from '@/offline/queue';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('mutation queue', () => {
  it('enqueues and persists a mutation', async () => {
    const store = createQueueStore();
    await enqueue(store, { type: 'create_komanda', payload: { local_uuid: 'a' } });

    const persisted = JSON.parse((await AsyncStorage.getItem(QUEUE_STORAGE_KEY)) ?? '[]');
    expect(persisted).toHaveLength(1);
    expect(persisted[0].type).toBe('create_komanda');
    expect(persisted[0].id).toBeDefined();
    expect(persisted[0].attemptCount).toBe(0);
  });

  it('dequeues by id', async () => {
    const store = createQueueStore();
    const m = await enqueue(store, { type: 'create_komanda', payload: { local_uuid: 'a' } });
    await dequeue(store, m.id);
    expect(await getAll(store)).toEqual([]);
  });

  it('markFailed increments attemptCount and records error', async () => {
    const store = createQueueStore();
    const m = await enqueue(store, { type: 'create_komanda', payload: { local_uuid: 'a' } });
    await markFailed(store, m.id, 'boom');
    const [persisted] = await getAll(store);
    expect(persisted.attemptCount).toBe(1);
    expect(persisted.lastError).toBe('boom');
  });

  it('dequeueWithDependents cascades through children and grandchildren', async () => {
    const store = createQueueStore();
    const create = await enqueue(store, {
      type: 'create_komanda',
      payload: { local_uuid: 'k1' },
    });
    await enqueue(store, {
      type: 'add_item',
      payload: { item_local_uuid: 'i1', komanda_id: 'k1' },
    });
    await enqueue(store, {
      type: 'update_item',
      payload: { item_id: 'i1', quantity: 2 },
    });
    await enqueue(store, {
      type: 'close_komanda',
      payload: { komanda_id: 'k1' },
    });
    // Sibling not related to k1; must survive.
    await enqueue(store, {
      type: 'create_komanda',
      payload: { local_uuid: 'k2' },
    });

    await dequeueWithDependents(store, [create.id]);

    const remaining = await getAll(store);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].type).toBe('create_komanda');
    expect((remaining[0].payload as any).local_uuid).toBe('k2');
  });

  it('rehydrates from AsyncStorage on creation', async () => {
    await AsyncStorage.setItem(
      QUEUE_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'x',
          type: 'create_komanda',
          payload: { local_uuid: 'y' },
          createdAt: '2026-04-20T00:00:00.000Z',
          attemptCount: 2,
          lastError: null,
        },
      ])
    );
    const store = createQueueStore();
    await new Promise((r) => setTimeout(r, 0));
    const all = await getAll(store);
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('x');
  });
});
