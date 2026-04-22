import AsyncStorage from '@react-native-async-storage/async-storage';

export const LOCAL_STORE_KEY = '@komanda/local-ids/v1';

export interface LocalStore {
  map: () => Promise<Record<string, string>>;
  set: (next: Record<string, string>) => Promise<void>;
}

export function createLocalStore(): LocalStore {
  let memo: Record<string, string> | null = null;
  const hydrate = (async () => {
    const raw = await AsyncStorage.getItem(LOCAL_STORE_KEY);
    memo = raw ? (JSON.parse(raw) as Record<string, string>) : {};
  })();

  return {
    async map() {
      if (!memo) await hydrate;
      return memo!;
    },
    async set(next) {
      memo = next;
      await AsyncStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(next));
    },
  };
}

export async function rememberSync(
  store: LocalStore,
  localId: string,
  serverId: string
): Promise<void> {
  const m = await store.map();
  await store.set({ ...m, [localId]: serverId });
}

export async function resolveId(store: LocalStore, id: string): Promise<string> {
  const m = await store.map();
  return m[id] ?? id;
}
