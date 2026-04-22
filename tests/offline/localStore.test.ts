import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createLocalStore,
  rememberSync,
  resolveId,
  LOCAL_STORE_KEY,
} from '@/offline/localStore';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('localStore', () => {
  it('remembers local→server mappings and round-trips', async () => {
    const store = createLocalStore();
    await rememberSync(store, 'local-a', 'server-A');
    await rememberSync(store, 'local-b', 'server-B');
    expect(await resolveId(store, 'local-a')).toBe('server-A');
    expect(await resolveId(store, 'local-b')).toBe('server-B');
  });
  it('returns the input unchanged when no mapping exists', async () => {
    const store = createLocalStore();
    expect(await resolveId(store, 'never-mapped')).toBe('never-mapped');
  });
  it('persists across re-creation', async () => {
    const store = createLocalStore();
    await rememberSync(store, 'local-a', 'server-A');
    const store2 = createLocalStore();
    await new Promise((r) => setTimeout(r, 0));
    expect(await resolveId(store2, 'local-a')).toBe('server-A');
    expect(await AsyncStorage.getItem(LOCAL_STORE_KEY)).toBeTruthy();
  });
});
