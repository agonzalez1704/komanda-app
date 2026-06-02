import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

// Guarded require — module-eval-time `import * as Notifications` crashes the
// whole tree in environments that lack the native module (Expo Go SDK 53+,
// dev clients built before adding the dep). Lazy-fail to a noop instead.
type NotificationsModule = typeof import('expo-notifications');
let Notifications: NotificationsModule | null = null;
try {
  Notifications = require('expo-notifications') as NotificationsModule;
} catch (e) {
  console.warn('[root] expo-notifications unavailable', e);
}
import { QueryProvider } from '@/offline/QueryProvider';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useQueueDrain } from '@/offline/drain';
import { configureNotifications } from '@/notifications';
import { color } from '@/theme/tokens';

function QueueBoot() {
  useQueueDrain();
  return null;
}

/**
 * Wires notification configuration + the tap-response handler. Must live
 * at the root so it captures notifications received while the app was
 * killed (cold-start tap) AND while it was backgrounded.
 *
 * Tap payload contract: `data.komanda_id` (string) → push to detail.
 * Other notification kinds will add their own routing here later.
 */
function NotificationsBoot() {
  const router = useRouter();
  // useLastNotificationResponse fires once for the response that launched
  // the app (cold-start) AND any subsequent taps. Replaces the older
  // getLastNotificationResponseAsync + addNotificationResponseReceivedListener
  // combo with a single reactive value.
  const lastResponse = Notifications?.useLastNotificationResponse?.() ?? null;

  useEffect(() => {
    void configureNotifications();
  }, []);

  useEffect(() => {
    if (!lastResponse) return;
    const data = lastResponse.notification.request.content.data as
      | { komanda_id?: string }
      | undefined;
    if (data?.komanda_id) {
      router.push(`/(app)/komandas/${data.komanda_id}` as const);
    }
  }, [lastResponse, router]);

  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryProvider>
          <QueueBoot />
          <NotificationsBoot />
          <OfflineBanner />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: color.bg },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(app)" />
          </Stack>
          <StatusBar style="dark" />
        </QueryProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.bg,
  },
});
