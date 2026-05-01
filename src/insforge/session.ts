import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import {
  AUTH_CLEARED_EVENT,
  AUTH_TOKEN_KEY,
  bootstrapSession,
  loadCachedUser,
} from './client';

export type SessionState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; session: { userId: string; email: string } };

/**
 * Reads the current auth state from AsyncStorage.
 *
 * We deliberately avoid `insforge.auth.getCurrentUser()` here: in server mode
 * that call reads from a private tokenManager that `setAuthToken` does not
 * populate, so it returns an empty user right after a fresh sign-in. Sourcing
 * identity from the cache we wrote during sign-in is both faster and more
 * reliable; the SDK's `autoRefreshToken` handles expiration on the next API
 * call.
 *
 * Returns a stable `refreshSession` function that sign-in / sign-out screens
 * can call to force a re-check without unmounting the hook.
 */
export function useSession(): SessionState & { refreshSession: () => void } {
  const [state, setState] = useState<SessionState>({ status: 'loading' });
  const refreshCountRef = useRef(0);
  const [refreshTick, setRefreshTick] = useState(0);

  const refreshSession = () => {
    refreshCountRef.current += 1;
    setRefreshTick((t) => t + 1);
  };

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      await bootstrapSession();

      const [accessToken, user] = await Promise.all([
        AsyncStorage.getItem(AUTH_TOKEN_KEY),
        loadCachedUser(),
      ]);

      if (!mounted) return;

      if (!accessToken || !user) {
        setState({ status: 'signed-out' });
        return;
      }

      setState({
        status: 'signed-in',
        session: { userId: user.id, email: user.email },
      });
    }

    checkSession();
    return () => {
      mounted = false;
    };
    // refreshTick is intentionally included so callers can trigger a re-check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTick]);

  // SDK fires this when its internal refresh dies — local tokens are wiped at
  // that point. Bouncing refreshTick re-runs the effect, which re-reads
  // AsyncStorage (now empty) and flips state to signed-out.
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(AUTH_CLEARED_EVENT, () => {
      refreshCountRef.current += 1;
      setRefreshTick((t) => t + 1);
    });
    return () => sub.remove();
  }, []);

  return { ...state, refreshSession };
}
