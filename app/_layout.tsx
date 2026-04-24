import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
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
    <SafeAreaProvider>
      <QueryProvider>
        <QueueBoot />
        <View style={styles.root}>
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
        </View>
        <StatusBar style="dark" />
      </QueryProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.bg,
  },
});
