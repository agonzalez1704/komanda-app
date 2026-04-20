import { useEffect, useRef, useState } from 'react';
import { insforge, bootstrapSession } from './client';

export type SessionState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; session: { userId: string; email: string } };

/**
 * Reads and validates the current auth state from the SDK.
 * Must be called after `bootstrapSession()` has restored the token.
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
      const { data, error } = await insforge.auth.getCurrentUser();
      if (!mounted) return;
      if (error || !data?.user?.id || !data?.user?.email) {
        setState({ status: 'signed-out' });
      } else {
        setState({
          status: 'signed-in',
          session: { userId: data.user.id, email: data.user.email },
        });
      }
    }

    checkSession();
    return () => {
      mounted = false;
    };
    // refreshTick is intentionally included so callers can trigger a re-check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTick]);

  return { ...state, refreshSession };
}
