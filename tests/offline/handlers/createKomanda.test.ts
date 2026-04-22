import AsyncStorage from '@react-native-async-storage/async-storage';
import { createKomandaHandler } from '@/offline/handlers/createKomanda';
import { createLocalStore, resolveId } from '@/offline/localStore';

jest.mock('@/insforge/client', () => ({
  insforge: {
    database: {
      rpc: jest.fn(),
      from: jest.fn(),
    },
  },
}));
import { insforge } from '@/insforge/client';

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('createKomandaHandler', () => {
  it('allocates a number via RPC, inserts the komanda, and records the id mapping', async () => {
    (insforge.database.rpc as jest.Mock).mockResolvedValue({
      data: 'komanda-20260420-001',
      error: null,
    });
    const single = jest.fn().mockResolvedValue({
      data: {
        id: 'server-id-1',
        org_id: 'org-1',
        number: 'komanda-20260420-001',
        display_name: null,
        status: 'open',
        opened_by_auth_user_id: 'user-1',
        opened_at: '2026-04-20T00:00:00.000Z',
        closed_at: null,
        closed_by_auth_user_id: null,
        payment_method: null,
        total_cents: null,
        local_uuid: 'local-1',
      },
      error: null,
    });
    (insforge.database.from as jest.Mock).mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({ single }),
      }),
    });

    const localStore = createLocalStore();
    const handle = createKomandaHandler({ localStore });

    await handle({
      id: 'mut-1',
      type: 'create_komanda',
      payload: { local_uuid: 'local-1', display_name: null, opened_at: '2026-04-20T00:00:00.000Z' },
      createdAt: '2026-04-20T00:00:00.000Z',
      attemptCount: 0,
      lastError: null,
    });

    expect(insforge.database.rpc).toHaveBeenCalledWith('next_komanda_number', {
      p_date: '2026-04-20',
    });
    expect(await resolveId(localStore, 'local-1')).toBe('server-id-1');
  });
});
