import AsyncStorage from '@react-native-async-storage/async-storage';
import { insforge } from './client';
import {
  AUTH_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  shouldProactivelyRefresh,
} from './tokenPersistence';

// The SDK's postgrest fetch (used for every database insert/select/RPC) reads
// `tokenManager.getAccessToken()` and dispatches a raw fetch — bypassing the
// HttpClient's auto-refresh-on-401 path entirely. So when an access token
// expires mid-session, the database call returns 401 INVALID_TOKEN and the
// queue drain marks the mutation failed instead of refreshing.
//
// `ensureFreshAccessToken` is the preflight we run before drains (and other
// hot paths) to keep the in-memory token ahead of expiry. It reads the
// persisted access token, decides whether it's inside the leeway window, and
// — only then — drives a refresh through `auth.refreshSession`, which DOES go
// through the request handler that updates both `httpClient.userToken` and
// `tokenManager.accessToken` so subsequent postgrest calls send the new bearer.
let _inflight: Promise<void> | null = null;

export async function ensureFreshAccessToken(): Promise<void> {
  if (_inflight) return _inflight;
  _inflight = (async () => {
    try {
      const access = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      if (!access) return;
      if (!shouldProactivelyRefresh(access)) return;
      const refresh = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
      if (!refresh) return;
      await insforge.auth.refreshSession({ refreshToken: refresh });
    } catch {
      // Swallow: a genuinely-dead refresh token surfaces via the existing
      // dead-token UI (RetrySurface in app/(app)/_layout.tsx). We don't want
      // to crash the drain or block the caller — failed preflight just means
      // the next mutation attempt will see the same error path it would have
      // hit without us.
    } finally {
      _inflight = null;
    }
  })();
  return _inflight;
}

/** Test-only: clear the inflight memo between cases. */
export function __resetRefreshState(): void {
  _inflight = null;
}
