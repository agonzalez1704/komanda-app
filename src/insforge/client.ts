import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@insforge/sdk';
import { env } from '@/env';

export const AUTH_TOKEN_KEY = '@komanda/auth-token/v1';

export const insforge = createClient({
  baseUrl: env.EXPO_PUBLIC_INSFORGE_URL,
  anonKey: env.EXPO_PUBLIC_INSFORGE_ANON_KEY,
  autoRefreshToken: true,
});

/**
 * Call once at app boot to restore a persisted session.
 * Reads the token from AsyncStorage and injects it into the SDK's HTTP client
 * via the public `setAuthToken` method on `HttpClient`.
 */
export async function bootstrapSession(): Promise<void> {
  const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  if (token) {
    insforge.getHttpClient().setAuthToken(token);
  }
}

export async function persistToken(token: string): Promise<void> {
  await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
}
