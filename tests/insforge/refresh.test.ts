jest.mock('@react-native-async-storage/async-storage');

// Mock the SDK client. We assert that ensureFreshAccessToken calls
// `insforge.auth.refreshSession` with the persisted refresh token when the
// stored access token is past the proactive-refresh leeway window.
const mockRefreshSession = jest.fn(async (_args: { refreshToken: string }) => undefined);
jest.mock('@/insforge/client', () => ({
  insforge: {
    auth: {
      refreshSession: (args: { refreshToken: string }) => mockRefreshSession(args),
    },
  },
}));

// eslint-disable-next-line import/first
import AsyncStorage from '@react-native-async-storage/async-storage';
// eslint-disable-next-line import/first
import { AUTH_TOKEN_KEY, REFRESH_TOKEN_KEY } from '@/insforge/tokenPersistence';
// eslint-disable-next-line import/first
import { ensureFreshAccessToken, __resetRefreshState } from '@/insforge/refresh';

function makeJwt(expSecondsFromNow: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expSecondsFromNow }),
  ).toString('base64url');
  return `${header}.${payload}.sig`;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  mockRefreshSession.mockClear();
  __resetRefreshState();
});

describe('ensureFreshAccessToken', () => {
  it('no-ops when no access token is persisted', async () => {
    await ensureFreshAccessToken();
    expect(mockRefreshSession).not.toHaveBeenCalled();
  });

  it('no-ops when access token still has plenty of time', async () => {
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, makeJwt(60 * 60)); // 1h ahead
    await AsyncStorage.setItem(REFRESH_TOKEN_KEY, 'r1');
    await ensureFreshAccessToken();
    expect(mockRefreshSession).not.toHaveBeenCalled();
  });

  it('refreshes when access token is past the leeway window', async () => {
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, makeJwt(10)); // 10s ahead, inside default 60s leeway
    await AsyncStorage.setItem(REFRESH_TOKEN_KEY, 'r1');
    await ensureFreshAccessToken();
    expect(mockRefreshSession).toHaveBeenCalledWith({ refreshToken: 'r1' });
  });

  it('skips when refresh token is missing even if access is stale', async () => {
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, makeJwt(10));
    await ensureFreshAccessToken();
    expect(mockRefreshSession).not.toHaveBeenCalled();
  });

  it('dedupes concurrent calls into a single refreshSession invocation', async () => {
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, makeJwt(10));
    await AsyncStorage.setItem(REFRESH_TOKEN_KEY, 'r1');

    await Promise.all([
      ensureFreshAccessToken(),
      ensureFreshAccessToken(),
      ensureFreshAccessToken(),
    ]);
    expect(mockRefreshSession).toHaveBeenCalledTimes(1);
  });

  it('swallows refresh errors so callers do not have to handle them', async () => {
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, makeJwt(10));
    await AsyncStorage.setItem(REFRESH_TOKEN_KEY, 'r1');
    mockRefreshSession.mockRejectedValueOnce(new Error('refresh failed'));
    await expect(ensureFreshAccessToken()).resolves.toBeUndefined();
  });
});
