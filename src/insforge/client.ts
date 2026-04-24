import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@insforge/sdk';
import { env } from '@/env';
import {
  AUTH_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  USER_INFO_KEY,
  accessTokenExpMs,
  attachTokenPersistence,
  shouldProactivelyRefresh,
  type CachedUser,
} from './tokenPersistence';

// Re-export so existing callers keep working.
export {
  AUTH_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  USER_INFO_KEY,
  accessTokenExpMs,
  attachTokenPersistence,
  shouldProactivelyRefresh,
};
export type { CachedUser };

export const insforge = createClient({
  baseUrl: env.EXPO_PUBLIC_INSFORGE_URL,
  anonKey: env.EXPO_PUBLIC_INSFORGE_ANON_KEY,
  autoRefreshToken: true,
  // Mobile: bypasses CSRF (cookie-based), uses refresh_token body flow.
  isServerMode: true,
});

// Install persistence once for the app-wide client. The pure logic lives
// in ./tokenPersistence so tests can exercise it without pulling the SDK.
attachTokenPersistence(insforge);

// ---------------------------------------------------------------------------
// Cold-start bootstrap + proactive refresh
// ---------------------------------------------------------------------------

let _bootPromise: Promise<void> | null = null;

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
