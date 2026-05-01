import AsyncStorage from '@react-native-async-storage/async-storage';

// ---------------------------------------------------------------------------
// Token-rotation persistence primitives
// ---------------------------------------------------------------------------
// Kept in its own module (no @insforge/sdk import) so jest can import it
// without pulling the SDK's transitive deps through the pnpm-hoisted store.
// `client.ts` composes these with the real InsForgeClient on app boot.
// ---------------------------------------------------------------------------

export const AUTH_TOKEN_KEY = '@komanda/auth-token/v1';
export const REFRESH_TOKEN_KEY = '@komanda/refresh-token/v1';
export const USER_INFO_KEY = '@komanda/user-info/v1';

export type CachedUser = { id: string; email: string };

/**
 * Minimal surface of the SDK's HttpClient that we care about for
 * persistence. Typing it structurally (rather than importing the SDK's
 * concrete type) lets this module and its tests stay SDK-free.
 */
export type TokenSetterHttpClient = {
  setAuthToken: (token: string | null) => void;
  setRefreshToken: (token: string | null) => void;
};

export type HasHttpClient = {
  getHttpClient: () => TokenSetterHttpClient;
};

/**
 * Wraps `setAuthToken` and `setRefreshToken` on the HttpClient instance
 * so every mutation — sign-in, SDK auto-refresh, explicit refreshSession,
 * sign-out — persists to AsyncStorage as a side effect.
 *
 * Why this is necessary: the SDK's HttpClient auto-refreshes on 401
 * INVALID_TOKEN, rotating BOTH the access and refresh tokens server-side.
 * After rotation it pushes the new pair into its in-memory state but does
 * NOT write them to AsyncStorage — that's our job. Without this wiring, a
 * cold start after any rotation reads the ORIGINAL refresh token (now
 * invalidated), every request 401s, and the user sees "Your session
 * expired" even though they signed in the same morning.
 *
 * Defense-in-depth over hooking a single callback: whatever code path
 * changes the tokens, storage follows along.
 */
export function attachTokenPersistence(client: HasHttpClient): void {
  const http = client.getHttpClient() as TokenSetterHttpClient & {
    __komandaPersistenceAttached?: boolean;
  };
  // Guard against double-install: module is evaluated once in the app, but
  // tests call this explicitly on test fixtures; the guard keeps us safe if
  // anyone else imports and attaches a second time.
  if (http.__komandaPersistenceAttached) return;
  http.__komandaPersistenceAttached = true;

  const origSetAuthToken = http.setAuthToken.bind(http);
  http.setAuthToken = (token: string | null) => {
    origSetAuthToken(token);
    // Fire-and-forget: AsyncStorage writes are non-critical to the call
    // site's correctness (the in-memory token is what the next request
    // uses), but they determine cold-start health.
    if (token) void AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
    else void AsyncStorage.removeItem(AUTH_TOKEN_KEY);
  };

  const origSetRefreshToken = http.setRefreshToken.bind(http);
  http.setRefreshToken = (token: string | null) => {
    origSetRefreshToken(token);
    if (token) void AsyncStorage.setItem(REFRESH_TOKEN_KEY, token);
    else void AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
  };
}

/**
 * Hook a listener that fires when the SDK clears its in-memory access token.
 *
 * Why this exists: when the SDK's internal refresh fails (refresh token dead),
 * the request handler clears the in-memory `userToken` / `refreshToken` *by
 * direct field assignment*, bypassing the wrapped `setAuthToken` / `setRefreshToken`
 * setters. AsyncStorage therefore keeps the stale pair forever — every cold
 * start reads it back, every API call 401s, and the queue drain pounds the
 * server with dead tokens.
 *
 * The `tokenManager.clearSession()` call that DOES happen on the failure path
 * fires `onTokenChange`. We attach to that, detect the null-token transition,
 * and run `onCleared` — typically wipes AsyncStorage and flips the app into
 * signed-out state.
 *
 * Wraps any pre-existing handler (the SDK's realtime client also subscribes)
 * so we don't clobber it.
 */
export type AuthClearedHookClient = {
  tokenManager: {
    onTokenChange: (() => void) | null;
    getAccessToken: () => string | null;
  };
};

export function attachAuthClearedListener(
  client: AuthClearedHookClient,
  onCleared: () => void,
): void {
  const tm = client.tokenManager;
  const prev = tm.onTokenChange;
  tm.onTokenChange = () => {
    if (prev) {
      try {
        prev();
      } catch {
        // Swallow: a misbehaving prior subscriber must not block our handler.
      }
    }
    if (tm.getAccessToken() == null) {
      onCleared();
    }
  };
}

/**
 * Decode a JWT's `exp` (seconds since epoch) and return it as milliseconds.
 * Returns null if the token is malformed or has no `exp` claim. We do NOT
 * verify the signature — this is only used to decide whether to pre-refresh.
 */
export function accessTokenExpMs(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json =
      typeof atob === 'function'
        ? atob(padded)
        : // Node fallback for tests. Hermes (RN) provides atob.
          (globalThis as { Buffer?: { from(s: string, enc: string): { toString(enc: string): string } } }).Buffer!.from(
            padded,
            'base64',
          ).toString('binary');
    const obj = JSON.parse(json);
    if (typeof obj.exp !== 'number') return null;
    return obj.exp * 1000;
  } catch {
    return null;
  }
}

/** True if the access token is expired or within `leewayMs` of expiring. */
export function shouldProactivelyRefresh(
  accessToken: string,
  now: number = Date.now(),
  leewayMs: number = 60_000,
): boolean {
  const expMs = accessTokenExpMs(accessToken);
  if (expMs == null) return false;
  return expMs - now < leewayMs;
}
