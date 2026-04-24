import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type InsForgeClient } from '@insforge/sdk';
import { env } from '@/env';

export const AUTH_TOKEN_KEY = '@komanda/auth-token/v1';
export const REFRESH_TOKEN_KEY = '@komanda/refresh-token/v1';
export const USER_INFO_KEY = '@komanda/user-info/v1';

export type CachedUser = { id: string; email: string };

export const insforge = createClient({
  baseUrl: env.EXPO_PUBLIC_INSFORGE_URL,
  anonKey: env.EXPO_PUBLIC_INSFORGE_ANON_KEY,
  autoRefreshToken: true,
  // Mobile: bypasses CSRF (cookie-based), uses refresh_token body flow.
  isServerMode: true,
});

// ---------------------------------------------------------------------------
// Token-rotation persistence
// ---------------------------------------------------------------------------
// The SDK's HttpClient auto-refreshes on 401 INVALID_TOKEN, rotating BOTH
// the access and refresh tokens server-side. After rotation it pushes the
// new pair into its in-memory state but does NOT write them to AsyncStorage
// — that's our job. Without this wiring, a cold start after any rotation
// reads the ORIGINAL refresh token (now invalidated), every request 401s,
// and the user sees "Your session expired" even though they signed in the
// same morning.
//
// We wrap `setAuthToken` and `setRefreshToken` on the HttpClient instance
// so every mutation — sign-in, SDK auto-refresh, explicit refreshSession,
// sign-out — persists to AsyncStorage as a side effect. This is
// defense-in-depth vs. hooking a single callback: whatever code path
// changes the tokens, storage follows along.
// ---------------------------------------------------------------------------

type AnyHttpClient = {
  setAuthToken: (token: string | null) => void;
  setRefreshToken: (token: string | null) => void;
};

export function attachTokenPersistence(client: InsForgeClient): void {
  const http = client.getHttpClient() as unknown as AnyHttpClient & {
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

// Install once for the app-wide client.
attachTokenPersistence(insforge);

// ---------------------------------------------------------------------------
// Cold-start bootstrap + proactive refresh
// ---------------------------------------------------------------------------

let _bootPromise: Promise<void> | null = null;

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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (globalThis as any).Buffer.from(padded, 'base64').toString('binary');
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

/**
 * Restores any persisted tokens into the HTTP client so subsequent requests
 * carry the Authorization header. If the access token is already expired or
 * near expiry, we proactively refresh BEFORE the app makes its first request.
 *
 * Without the proactive refresh, every cold start with a stale access token
 * would fire 5+ parallel queries (membership, komandas, products, ...) each
 * of which 401s independently — the SDK's internal refresh dedupe is per
 * instance but the error UI we surface only needs one failure to trigger.
 */
export function bootstrapSession(): Promise<void> {
  if (!_bootPromise) {
    _bootPromise = (async () => {
      const [access, refresh] = await Promise.all([
        AsyncStorage.getItem(AUTH_TOKEN_KEY),
        AsyncStorage.getItem(REFRESH_TOKEN_KEY),
      ]);
      const http = insforge.getHttpClient();
      if (access) http.setAuthToken(access);
      if (refresh) http.setRefreshToken(refresh);

      if (access && refresh && shouldProactivelyRefresh(access)) {
        try {
          await insforge.auth.refreshSession({ refreshToken: refresh });
          // setAuthToken / setRefreshToken wrappers installed above will
          // mirror the new pair into AsyncStorage automatically.
        } catch (e) {
          // Refresh can fail for two reasons:
          //   1. Refresh token is genuinely dead (rotated away, or user
          //      revoked). App will land on "signed-in" from cached user
          //      info, the first real API call will 401, and the layout's
          //      retry surface will offer "Sign in again".
          //   2. Transient network failure. We don't want to force sign-out
          //      in that case — the app works offline with cached data.
          // Either way: don't clear tokens here. Let downstream errors
          // surface to the normal retry UI.
          if (__DEV__) {
            // eslint-disable-next-line no-console
            console.warn('[bootstrapSession] proactive refresh failed', e);
          }
        }
      }
    })();
  }
  return _bootPromise;
}

export function resetBootstrap(): void {
  _bootPromise = null;
}

export async function persistSession(tokens: {
  accessToken?: string | null;
  refreshToken?: string | null;
  user?: CachedUser | null;
}): Promise<void> {
  const http = insforge.getHttpClient();
  // AsyncStorage writes for the tokens themselves happen inside the
  // setAuthToken / setRefreshToken wrappers installed by
  // attachTokenPersistence. We only need to write user info explicitly.
  if (tokens.accessToken) http.setAuthToken(tokens.accessToken);
  if (tokens.refreshToken) http.setRefreshToken(tokens.refreshToken);
  if (tokens.user && tokens.user.id && tokens.user.email) {
    await AsyncStorage.setItem(
      USER_INFO_KEY,
      JSON.stringify({ id: tokens.user.id, email: tokens.user.email }),
    );
  }
}

// Backwards-compat wrapper: callers that only have accessToken can keep using this.
export async function persistToken(token: string): Promise<void> {
  await persistSession({ accessToken: token });
}

export async function loadCachedUser(): Promise<CachedUser | null> {
  const raw = await AsyncStorage.getItem(USER_INFO_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.id === 'string' && typeof parsed.email === 'string') {
      return { id: parsed.id, email: parsed.email };
    }
    return null;
  } catch {
    return null;
  }
}

export async function clearToken(): Promise<void> {
  const http = insforge.getHttpClient();
  // Clearing via the wrappers ensures AsyncStorage is purged too.
  http.setAuthToken(null);
  http.setRefreshToken(null);
  await AsyncStorage.removeItem(USER_INFO_KEY);
}
