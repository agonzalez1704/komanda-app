import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/insforge/session';
import { fetchMyMembership } from '@/insforge/queries/membership';

export default function AppLayout() {
  const session = useSession();

  const signedIn = session.status === 'signed-in';
  const membership = useQuery({
    queryKey: ['membership', session.status === 'signed-in' ? session.session.userId : null],
    queryFn: fetchMyMembership,
    enabled: signedIn,
    staleTime: 1000 * 60 * 5,
  });

  if (session.status === 'loading') {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  if (session.status === 'signed-out') {
    return <Redirect href="/(auth)/sign-in" />;
  }
  if (membership.isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  if (!membership.data) {
    return <Redirect href="/(auth)/no-org" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
