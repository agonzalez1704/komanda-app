import { createClient } from '@insforge/sdk';
import { env } from '@/env';

export const insforge = createClient({
  baseUrl: env.EXPO_PUBLIC_INSFORGE_URL,
  anonKey: env.EXPO_PUBLIC_INSFORGE_ANON_KEY,
  autoRefreshToken: true,
});
