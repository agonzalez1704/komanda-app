import { Platform } from 'react-native';

// Native modules ship with the binary. When running in an environment that
// doesn't have ExpoPushTokenManager linked (Expo Go on SDK 53+, dev client
// built before adding the dep), the bare `import * as` would throw at
// module-eval time and take the whole layout tree down with it. Guard so a
// missing native module degrades to a no-op instead of breaking boot.
type NotificationsModule = typeof import('expo-notifications');
type DeviceModule = typeof import('expo-device');

let Notifications: NotificationsModule | null = null;
let Device: DeviceModule | null = null;
try {
  Notifications = require('expo-notifications') as NotificationsModule;
} catch (e) {
  console.warn('[notifications] expo-notifications unavailable, disabling', e);
}
try {
  Device = require('expo-device') as DeviceModule;
} catch (e) {
  console.warn('[notifications] expo-device unavailable, disabling', e);
}

const isAvailable = (): boolean => Notifications !== null;

export async function configureNotifications(): Promise<void> {
  if (!Notifications) return;

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

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!Notifications || !Device) return false;
  if (!Device.isDevice) return false;
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

export async function notifyKomandaCreated(p: KomandaCreatedPayload): Promise<void> {
  if (!Notifications) {
    console.warn('[notifyKomandaCreated] native module unavailable — rebuild dev client');
    return;
  }
  const granted = await ensureNotificationPermission();
  if (!granted) {
    console.warn('[notifyKomandaCreated] permission not granted, skipping', {
      isDevice: Device?.isDevice,
    });
    return;
  }

  const titleParts = [
    'Nueva komanda',
    p.number ? `#${p.number}` : null,
  ].filter(Boolean);
  const body = p.display_name
    ? `${p.display_name} acaba de abrir una orden`
    : 'Un mesero abrió una orden nueva';

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: titleParts.join(' '),
        body,
        sound: 'default',
        data: { komanda_id: p.id, kind: 'komanda_created' },
      },
      trigger: null,
      ...(Platform.OS === 'android' ? { channelId: 'komandas' } : {}),
    });
    console.log('[notifyKomandaCreated] scheduled', p.id);
  } catch (e) {
    console.warn('[notifyKomandaCreated] schedule failed', e);
  }
}

export const notificationsAvailable = isAvailable;
