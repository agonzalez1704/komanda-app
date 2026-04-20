import { useEffect, useState } from 'react';
import type { UserSchema } from '@insforge/sdk';
import { insforge } from './client';

export type Session = {
  userId: string;
  email: string;
  accessToken: string;
} | null;

type SessionState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; session: NonNullable<Session> };

/**
 * Convert a raw user from getCurrentUser into a typed SessionState.
 * The SDK's Auth class does not expose getSession() or onAuthStateChange();
 * session state is derived from getCurrentUser() on mount.
 */
function toState(user: UserSchema | null | undefined, accessToken?: string | null): SessionState {
  if (!user?.id || !user?.email || !accessToken) {
    return { status: 'signed-out' };
  }
  return {
    status: 'signed-in',
    session: { userId: user.id, email: user.email, accessToken },
  };
}

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ status: 'loading' });

  useEffect(() => {
    let mounted = true;

    insforge.auth.getCurrentUser().then((res) => {
      if (!mounted) return;
      // The SDK stores the access token in the TokenManager (memory-only).
      // We reach it via the internal HTTP client headers as a fallback.
      const http = insforge.getHttpClient();
      const authHeader = http.getHeaders()['Authorization'] ?? http.getHeaders()['authorization'];
      const accessToken = authHeader?.replace(/^Bearer\s+/i, '') ?? null;
      setState(toState(res.data?.user, accessToken));
    });

    return () => {
      mounted = false;
    };
  }, []);

  return state;
}
