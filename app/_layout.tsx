import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import { QueryProvider } from '@/offline/QueryProvider';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useQueueDrain } from '@/offline/drain';
import { color } from '@/theme/tokens';

function QueueBoot() {
  useQueueDrain();
  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryProvider>
          <QueueBoot />
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
