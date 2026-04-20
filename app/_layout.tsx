import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { QueryProvider } from '@/offline/QueryProvider';
import { OfflineBanner } from '@/components/OfflineBanner';

export default function RootLayout() {
  return (
    <QueryProvider>
      <OfflineBanner />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
      <StatusBar style="auto" />
    </QueryProvider>
  );
}
