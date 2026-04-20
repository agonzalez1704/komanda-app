import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@insforge/sdk';
import { env } from '@/env';

export const AUTH_TOKEN_KEY = '@komanda/auth-token/v1';

export const insforge = createClient({
  baseUrl: env.EXPO_PUBLIC_INSFORGE_URL,
  anonKey: env.EXPO_PUBLIC_INSFORGE_ANON_KEY,
  autoRefreshToken: true,
});

let _bootPromise: Promise<void> | null = null;

/**
 * Call once at app boot to restore a persisted session.
 * Reads the token from AsyncStorage and injects it into the SDK's HTTP client
 * via the public `setAuthToken` method on `HttpClient`.
 *
 * Memoized: AsyncStorage is only read once per app lifetime.
 */
export function bootstrapSession(): Promise<void> {
  if (!_bootPromise) {
    _bootPromise = AsyncStorage.getItem(AUTH_TOKEN_KEY).then((token) => {
      if (token) {
        insforge.getHttpClient().setAuthToken(token);
      }
    });
  }
  return _bootPromise;
}

/**
 * Reset the bootstrap promise. Useful for tests.
 */
export function resetBootstrap(): void {
  _bootPromise = null;
}

export async function persistToken(token: string): Promise<void> {
  await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
}
