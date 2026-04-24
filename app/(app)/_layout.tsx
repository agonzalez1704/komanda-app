import { Redirect, Stack, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useIsRestoring, useQuery } from '@tanstack/react-query';
import { useSession } from '@/insforge/session';
import { fetchMyMembership } from '@/insforge/queries/membership';
import { clearToken, insforge } from '@/insforge/client';
import { resetCreateKomandaContext } from '@/offline/handlers/createKomanda';
import { formatError } from '@/offline/processor';
import { color, fontWeight, radius, space } from '@/theme/tokens';

/**
 * True when the error message looks like an auth/permission failure rather
 * than a network blip. We lean on message-shape because the SDK's
 * InsForgeError wraps server responses with a `message` that reliably
 * contains one of these tokens for 401/403 paths.
 */
function isAuthError(error: unknown): boolean {
  const message = formatError(error);
  return /\b(401|403|jwt|token|unauthor|forbidden|permission|not authent)/i.test(
    message,
  );
}

export default function AppLayout() {
  const session = useSession();
  // PersistQueryClientProvider hydrates the cache from AsyncStorage
  // asynchronously. If we read membership.data before that finishes we'll
  // see `undefined` and falsely redirect to no-org. Wait for restore.
  const isRestoring = useIsRestoring();

  const signedIn = session.status === 'signed-in';
  const membership = useQuery({
    // Stable key shared with settings.tsx, no-org.tsx, etc. so a single
    // cache entry serves the whole app and `qc.invalidateQueries({queryKey:
    // ['membership']})` from no-org actually reaches this layout.
    queryKey: ['membership'],
    queryFn: fetchMyMembership,
    enabled: signedIn && !isRestoring,
    // Membership changes only on org create/leave — both flows manually
    // invalidate. Keep it forever otherwise so we don't refetch on every
    // mount and risk a transient null bouncing the user to no-org.
    staleTime: Infinity,
    // Retry policy:
    //   - SDK's HttpClient already handles 401 INVALID_TOKEN internally
    //     with one refresh-and-retry. If a second 401 surfaces to us, the
    //     refresh token is dead — retrying won't help, it just delays the
    //     inevitable "Sign in again" prompt.
    //   - Transient network errors deserve a short retry. Two attempts
    //     spaced ~2s is enough to ride out a flaky connection without
    //     stalling the loader for 10+ seconds.
    retry: (failureCount, error) => {
      if (isAuthError(error)) return false;
      return failureCount < 2;
    },
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 3000),
  });

  if (session.status === 'loading' || isRestoring) return <Loader />;
  if (session.status === 'signed-out') return <Redirect href="/(auth)/sign-in" />;
  // Block only on the first load (no cached data yet). Do NOT unmount the
  // Stack for background refetches (`isFetching` without `isPending`): a
  // child screen that subscribes to ['membership'] with a shorter staleTime
  // will trigger one on mount, and if we swap the Stack out for <Loader />
  // mid-navigation the router state resets — the pushed screen ends up as
  // the only route and router.back() fires "GO_BACK was not handled".
  if (membership.isPending) return <Loader />;
  if (membership.isError && !membership.data) {
    return (
      <RetrySurface
        error={membership.error}
        onRetry={() => membership.refetch()}
      />
    );
  }
  if (membership.data === null) return <Redirect href="/(auth)/no-org" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: color.bg },
        animation: 'slide_from_right',
      }}
    />
  );
}

function Loader() {
  return (
    <View style={styles.loader}>
      <ActivityIndicator color={color.primary} />
    </View>
  );
}

function RetrySurface({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry: () => void;
}) {
  const router = useRouter();
  const message = formatError(error);
  // When the SDK's internal refresh already failed, retrying with the same
  // dead token will keep 401-ing — surface sign-out as the primary action.
  const isAuthFailure = isAuthError(error);

  async function signOutAndStartOver() {
    try {
      await clearToken();
      resetCreateKomandaContext();
      await insforge.auth.signOut();
    } catch {
      // Sign-out failures here are non-fatal; we just want to clear local state.
    }
    router.replace('/(auth)/sign-in');
  }

  return (
    <View style={styles.retryRoot}>
      <View style={styles.retryCard}>
        <View style={styles.retryIconWrap}>
          <Text style={styles.retryIcon}>⚠︎</Text>
        </View>
        <Text style={styles.retryTitle}>
          {isAuthFailure ? 'Your session expired' : 'Couldn’t reach the server'}
        </Text>
        <Text style={styles.retrySubtitle}>
          {isAuthFailure
            ? 'Please sign in again to continue.'
            : 'We weren’t able to confirm your organization. Check your connection and try again.'}
        </Text>

        {message ? (
          <ScrollView
            style={styles.errorBox}
            contentContainerStyle={{ padding: space.sm }}
          >
            <Text style={styles.errorText} selectable>
              {message}
            </Text>
          </ScrollView>
        ) : null}

        <View style={styles.retryActions}>
          {isAuthFailure ? (
            <>
              <Pressable
                onPress={signOutAndStartOver}
                accessibilityRole="button"
                accessibilityLabel="Sign in again"
                style={({ pressed }) => [
                  styles.retryButton,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.retryButtonLabel}>Sign in again</Text>
              </Pressable>
              <Pressable
                onPress={onRetry}
                accessibilityRole="button"
                accessibilityLabel="Try anyway"
                style={({ pressed }) => [
                  styles.retryGhost,
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Text style={styles.retryGhostLabel}>Try again anyway</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable
                onPress={onRetry}
                accessibilityRole="button"
                accessibilityLabel="Retry"
                style={({ pressed }) => [
                  styles.retryButton,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.retryButtonLabel}>Retry</Text>
              </Pressable>
              <Pressable
                onPress={signOutAndStartOver}
                accessibilityRole="button"
                accessibilityLabel="Sign out"
                style={({ pressed }) => [
                  styles.retryGhost,
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Text style={styles.retryGhostLabel}>Sign out</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.bg,
    paddingHorizontal: space.xl,
    gap: space.md,
  },
  retryRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.bg,
    paddingHorizontal: space.lg,
  },
  retryCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: color.surface,
    borderRadius: radius.xl,
    paddingHorizontal: space.lg,
    paddingVertical: space.xl,
    alignItems: 'center',
    gap: space.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  retryIconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: color.warningBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },
  retryIcon: {
    fontSize: 28,
    color: color.warningText,
    lineHeight: 32,
  },
  retryTitle: {
    fontSize: 18,
    fontWeight: fontWeight.semibold,
    color: color.textPrimary,
    textAlign: 'center',
  },
  retrySubtitle: {
    fontSize: 14,
    color: color.textSecondary,
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 20,
  },
  errorBox: {
    alignSelf: 'stretch',
    maxHeight: 120,
    marginTop: space.sm,
    backgroundColor: color.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'Menlo',
    color: color.textSecondary,
    lineHeight: 16,
  },
  retryActions: {
    alignSelf: 'stretch',
    gap: space.xs,
    marginTop: space.md,
  },
  retryButton: {
    backgroundColor: color.primary,
    borderRadius: radius.full,
    paddingHorizontal: space.xl,
    paddingVertical: space.sm,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonLabel: {
    color: color.primaryOn,
    fontSize: 15,
    fontWeight: fontWeight.semibold,
  },
  retryGhost: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryGhostLabel: {
    color: color.textSecondary,
    fontSize: 14,
    fontWeight: fontWeight.medium,
  },
});
