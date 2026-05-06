import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

/**
 * One-time setup for local notification handling. Call once at app boot.
 *
 * What this does:
 *   - Registers a notification handler so foreground notifications still
 *     surface as banners (default RN behavior is to suppress them).
 *   - Requests permission on iOS the first time we try to schedule one.
 *     Android grants by default but iOS requires explicit auth.
 *   - Creates an Android notification channel for komanda events so the
 *     OS can group + sound them appropriately.
 */
export async function configureNotifications(): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('komandas', {
      name: 'Komandas',
      description: 'Nuevas órdenes y cambios de estado',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF5B1F',
    });
  }
}

/**
 * Request notification permission lazily — call before scheduling. We don't
 * spam the prompt at startup; instead trigger it the first time we'd
 * actually want to fire a notification.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!Device.isDevice) return false; // simulators don't deliver
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  if (existing === 'denied') return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export type KomandaCreatedPayload = {
  id: string;
  org_id: string;
  opened_by_auth_user_id: string;
  display_name: string | null;
  number: string | null;
  opened_at: string;
};

/**
 * Schedule an immediate local notification for a newly created komanda.
 * Tap navigates to the detail screen via the data.komanda_id field —
 * RootLayout's response handler reads it and routes there.
 */
export async function notifyKomandaCreated(p: KomandaCreatedPayload): Promise<void> {
  const granted = await ensureNotificationPermission();
  if (!granted) return;

  const titleParts = [
    'Nueva komanda',
    p.number ? `#${p.number}` : null,
  ].filter(Boolean);
  const body = p.display_name
    ? `${p.display_name} acaba de abrir una orden`
    : 'Un mesero abrió una orden nueva';

  await Notifications.scheduleNotificationAsync({
    content: {
      title: titleParts.join(' '),
      body,
      sound: 'default',
      data: { komanda_id: p.id, kind: 'komanda_created' },
    },
    trigger: null, // fire immediately
    ...(Platform.OS === 'android' ? { channelId: 'komandas' } : {}),
  });
}
