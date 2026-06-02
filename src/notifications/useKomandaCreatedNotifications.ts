import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { insforge } from '@/insforge/client';
import { can, type Role } from '@/auth/permissions';
import {
  ensureNotificationPermission,
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

    // Ask for permission up-front so the OS prompt fires before the first
    // notification, not at the moment of the first event (which would
    // suppress that first notification on a fresh install).
    void ensureNotificationPermission().then((granted) => {
      console.log('[komandaCreatedNotifs] permission', { granted });
    });

    function handleCreated(message: unknown) {
      // Insforge SDK delivers a SocketMessage envelope: { meta, ...payload }
      // (top-level passthrough). Older builds nested payload under .payload.
      // Accept both shapes so we don't silently drop events.
      const m = message as
        | (KomandaCreatedPayload & { payload?: KomandaCreatedPayload })
        | { payload: KomandaCreatedPayload }
        | undefined;
      const p: KomandaCreatedPayload | undefined =
        m && 'id' in m && typeof (m as KomandaCreatedPayload).id === 'string'
          ? (m as KomandaCreatedPayload)
          : (m as { payload?: KomandaCreatedPayload } | undefined)?.payload;

      if (!p || typeof p.id !== 'string') {
        console.warn(
          '[komandaCreatedNotifs] unrecognized payload shape',
          message,
        );
        return;
      }
      // Skip self — the creator already knows.
      if (p.opened_by_auth_user_id === authUserId) {
        return;
      }

      // Refresh the today list cache so the new row appears even before
      // the user navigates back to the list.
      qc.invalidateQueries({ queryKey: ['komandas', 'all'] });
      qc.invalidateQueries({ queryKey: ['komandas', 'today'] });

      console.log('[komandaCreatedNotifs] firing local notification', p.id);
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
        console.log('[komandaCreatedNotifs] subscribed', channel);
      } catch (e) {
        console.warn('[komandaCreatedNotifs] connect failed', e);
      }
    })();

    return () => {
      cancelled = true;
      detach?.();
      insforge.realtime.unsubscribe(channel);
    };
  }, [orgId, authUserId, role, qc]);
}
