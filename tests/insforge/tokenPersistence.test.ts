jest.mock('@react-native-async-storage/async-storage');

// eslint-disable-next-line import/first
import AsyncStorage from '@react-native-async-storage/async-storage';
// eslint-disable-next-line import/first
import {
  AUTH_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  accessTokenExpMs,
  attachTokenPersistence,
  shouldProactivelyRefresh,
  type HasHttpClient,
} from '@/insforge/tokenPersistence';

beforeEach(async () => {
  await AsyncStorage.clear();
});

/**
 * Build a minimal stand-in for `InsForgeClient` so we can assert that
 * `attachTokenPersistence` correctly wraps the HttpClient's token
 * setters. We only need the two setters the wrapper touches.
 */
function makeFakeClient() {
  const state: { access: string | null; refresh: string | null } = {
    access: null,
    refresh: null,
  };
  const http = {
    setAuthToken: jest.fn((token: string | null) => {
      state.access = token;
    }),
    setRefreshToken: jest.fn((token: string | null) => {
      state.refresh = token;
    }),
  };
  const client: HasHttpClient = {
    getHttpClient: () => http,
  };
  return { client, http, state };
}

/**
 * Hand-craft a JWT with a given `exp` claim. We don't care about the
 * signature; `accessTokenExpMs` reads the payload without verifying.
 */
function jwtWithExp(expSeconds: number | null): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify(expSeconds == null ? {} : { exp: expSeconds }),
  ).toString('base64url');
  const signature = 'sig';
  return `${header}.${payload}.${signature}`;
}

describe('attachTokenPersistence', () => {
  it('mirrors setAuthToken into AsyncStorage', async () => {
    const { client, http } = makeFakeClient();
    attachTokenPersistence(client);

    http.setAuthToken('access-123');
    // Wrapper fires fire-and-forget writes; flush the microtask queue.
    await Promise.resolve();

    expect(await AsyncStorage.getItem(AUTH_TOKEN_KEY)).toBe('access-123');
  });

  it('mirrors setRefreshToken into AsyncStorage', async () => {
    const { client, http } = makeFakeClient();
    attachTokenPersistence(client);

    http.setRefreshToken('refresh-123');
    await Promise.resolve();

    expect(await AsyncStorage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-123');
  });

  it('removes tokens from AsyncStorage when set to null', async () => {
    const { client, http } = makeFakeClient();
    attachTokenPersistence(client);

    http.setAuthToken('access-123');
    http.setRefreshToken('refresh-123');
    await Promise.resolve();
    expect(await AsyncStorage.getItem(AUTH_TOKEN_KEY)).toBe('access-123');

    http.setAuthToken(null);
    http.setRefreshToken(null);
    await Promise.resolve();
    expect(await AsyncStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
    expect(await AsyncStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
  });

  it('persists tokens rotated by the SDK (simulated silent rotation)', async () => {
    // Simulates what happens inside HttpClient when it hits a 401
    // INVALID_TOKEN, calls handleTokenRefresh, and pushes the new pair
    // into the client via the same setters. Pre-fix this produced an
    // in-memory rotation that never reached AsyncStorage, so a cold
    // start re-read the dead tokens.
    const { client, http } = makeFakeClient();
    attachTokenPersistence(client);

    // Initial sign-in writes.
    http.setAuthToken('access-initial');
    http.setRefreshToken('refresh-initial');
    await Promise.resolve();
    expect(await AsyncStorage.getItem(AUTH_TOKEN_KEY)).toBe('access-initial');
    expect(await AsyncStorage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-initial');

    // SDK rotates both tokens silently during a refresh.
    http.setAuthToken('access-rotated');
    http.setRefreshToken('refresh-rotated');
    await Promise.resolve();

    expect(await AsyncStorage.getItem(AUTH_TOKEN_KEY)).toBe('access-rotated');
    expect(await AsyncStorage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-rotated');
  });

  it('still invokes the original setters so the in-memory token updates', () => {
    const { client, http, state } = makeFakeClient();
    const origAuth = http.setAuthToken;
    const origRefresh = http.setRefreshToken;
    attachTokenPersistence(client);

    // The reference is reassigned; calling the new reference must still
    // drive the underlying state.
    http.setAuthToken('a');
    http.setRefreshToken('r');

    expect(state.access).toBe('a');
    expect(state.refresh).toBe('r');
    // And the original spies were invoked by the wrapper.
    expect(origAuth).toHaveBeenCalledWith('a');
    expect(origRefresh).toHaveBeenCalledWith('r');
  });

  it('is idempotent — calling twice does not double-wrap', async () => {
    const { client, http } = makeFakeClient();
    attachTokenPersistence(client);
    const wrappedOnce = http.setAuthToken;
    attachTokenPersistence(client);
    const wrappedTwice = http.setAuthToken;

    // Same function reference on the second call — no re-wrapping.
    expect(wrappedTwice).toBe(wrappedOnce);

    http.setAuthToken('only-once');
    await Promise.resolve();
    // One AsyncStorage write per call, not two.
    expect(await AsyncStorage.getItem(AUTH_TOKEN_KEY)).toBe('only-once');
  });
});

describe('accessTokenExpMs', () => {
  it('decodes a well-formed JWT exp claim into milliseconds', () => {
    const exp = 1_900_000_000; // arbitrary future second
    expect(accessTokenExpMs(jwtWithExp(exp))).toBe(exp * 1000);
  });

  it('returns null when the payload has no exp claim', () => {
    expect(accessTokenExpMs(jwtWithExp(null))).toBeNull();
  });

  it('returns null for a malformed token (wrong segment count)', () => {
    expect(accessTokenExpMs('not.ajwt')).toBeNull();
    expect(accessTokenExpMs('')).toBeNull();
  });

  it('returns null when the payload is not valid base64url JSON', () => {
    expect(accessTokenExpMs('header.@@@not-base64@@@.sig')).toBeNull();
  });
});

describe('shouldProactivelyRefresh', () => {
  const NOW = 1_800_000_000_000; // fixed ms

  it('returns true when the token is already expired', () => {
    const token = jwtWithExp(Math.floor(NOW / 1000) - 60);
    expect(shouldProactivelyRefresh(token, NOW)).toBe(true);
  });

  it('returns true when the token is within the default leeway of expiry', () => {
    // 30s until expiry, default leeway 60s.
    const token = jwtWithExp(Math.floor(NOW / 1000) + 30);
    expect(shouldProactivelyRefresh(token, NOW)).toBe(true);
  });

  it('returns false when the token still has comfortable runway', () => {
    // 10 minutes away.
    const token = jwtWithExp(Math.floor(NOW / 1000) + 600);
    expect(shouldProactivelyRefresh(token, NOW)).toBe(false);
  });

  it('honors a custom leeway', () => {
    // 2 minutes until expiry; default leeway would say false, 5-minute
    // leeway says true.
    const token = jwtWithExp(Math.floor(NOW / 1000) + 120);
    expect(shouldProactivelyRefresh(token, NOW, 60_000)).toBe(false);
    expect(shouldProactivelyRefresh(token, NOW, 300_000)).toBe(true);
  });

  it('returns false when exp cannot be decoded', () => {
    expect(shouldProactivelyRefresh('not.ajwt', NOW)).toBe(false);
  });
});
