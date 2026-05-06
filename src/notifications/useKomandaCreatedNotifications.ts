import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { insforge } from '@/insforge/client';
import { can, type Role } from '@/auth/permissions';
import {
  notifyKomandaCreated,
  type KomandaCreatedPayload,
} from '@/notifications';

/**
 * Subscribe to the org's komanda channel and fire local notifications for
 * NEW komandas created by OTHER members. Filters out:
 *   - Recipients whose role doesn't receive these notifs (waiters)
 *   - The user who actually opened the komanda (don't notify themselves)
 *
 * Lives at the (app) layout level so it runs whenever a signed-in member
 * is in the app shell. Subscription auto-cleans on unmount / logout.
 */
export function useKomandaCreatedNotifications(args: {
  orgId: string | null | undefined;
  authUserId: string | null | undefined;
  role: Role | null | undefined;
}) {
  const { orgId, authUserId, role } = args;
  const qc = useQueryClient();

  useEffect(() => {
    if (!orgId || !authUserId || !role) return;
    if (!can.receivesKomandaCreatedNotif(role)) return;

    const channel = `org:${orgId}:komandas`;
    let cancelled = false;
    let detach: (() => void) | null = null;

    function handleCreated(payload: unknown) {
      const p = payload as KomandaCreatedPayload | undefined;
      if (!p || typeof p.id !== 'string') return;
      // Skip self — the creator already knows.
      if (p.opened_by_auth_user_id === authUserId) return;

      // Refresh the today list cache so the new row appears even before
      // the user navigates back to the list. The notification body comes
      // from the realtime payload itself, no extra fetch needed.
      qc.invalidateQueries({ queryKey: ['komandas', 'today'] });

      void notifyKomandaCreated(p);
    }

    (async () => {
      try {
        await insforge.realtime.connect();
        if (cancelled) return;
        const result = await insforge.realtime.subscribe(channel);
        if (!result.ok) {
          console.warn(
            '[komandaCreatedNotifs] subscribe failed',
            channel,
            result.error?.message,
          );
          return;
        }
        insforge.realtime.on('created', handleCreated);
        detach = () => insforge.realtime.off('created', handleCreated);
      } catch (e) {
        console.warn('[komandaCreatedNotifs] connect failed', e);
      }
    })();

    return () => {
      cancelled = true;
      detach?.();
      // Don't disconnect the socket here — other features may share it
      // in the future, and the SDK keeps the channel sub alive only as
      // long as we have a listener.
      insforge.realtime.unsubscribe(channel);
    };
  }, [orgId, authUserId, role, qc]);
}
