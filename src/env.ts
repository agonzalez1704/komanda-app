import { z } from 'zod';

const schema = z.object({
  EXPO_PUBLIC_INSFORGE_URL: z.string().url(),
  EXPO_PUBLIC_INSFORGE_ANON_KEY: z.string().min(20),
});

const parsed = schema.safeParse({
  EXPO_PUBLIC_INSFORGE_URL: process.env.EXPO_PUBLIC_INSFORGE_URL,
  EXPO_PUBLIC_INSFORGE_ANON_KEY: process.env.EXPO_PUBLIC_INSFORGE_ANON_KEY,
});

if (!parsed.success) {
  throw new Error(
    `Invalid EXPO_PUBLIC_INSFORGE_* env vars:\n${parsed.error.toString()}`
  );
}

export const env = parsed.data;
