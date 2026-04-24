import React from 'react';
import { Link, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { insforge, clearToken } from '@/insforge/client';
import { fetchMyMembership } from '@/insforge/queries/membership';
import { resetCreateKomandaContext } from '@/offline/handlers/createKomanda';
import { Button, Card, Divider, Screen, ScreenHeader, Text } from '@/components/ui';
import { color, fontWeight, radius, space } from '@/theme/tokens';

export default function Settings() {
  const router = useRouter();
  const { data: membership } = useQuery({
    queryKey: ['membership'],
    queryFn: fetchMyMembership,
  });

  async function signOut() {
    await clearToken();
    resetCreateKomandaContext();
    await insforge.auth.signOut();
    router.replace('/(auth)/sign-in');
  }

  const initials = (membership?.display_name ?? '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  return (
    <Screen scrollable padded={false} contentContainerStyle={{ gap: space.lg, paddingBottom: space.xxl }}>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}>
        <ScreenHeader showBack title="Settings" />
      </View>

      <View style={styles.profile}>
        <View style={styles.avatar}>
          <Text
            style={{
              color: color.primaryOn,
              fontSize: 22,
              fontWeight: fontWeight.bold,
              letterSpacing: 0.5,
            }}
          >
            {initials || '•'}
          </Text>
        </View>
        <Text variant="h2" align="center">
          {membership?.display_name ?? '—'}
        </Text>
        {membership?.organization?.name ? (
          <Text variant="bodySm" align="center">
            {membership.organization.name}
          </Text>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text variant="label" style={styles.sectionLabel}>Management</Text>
        <Card padded={false}>
          <Link href="/(app)/menu" asChild>
            <NavRow
              icon="restaurant-outline"
              label="Menu"
              hint="Products, variants, and modifiers"
            />
          </Link>
        </Card>
      </View>

      <View style={styles.section}>
        <Text variant="label" style={styles.sectionLabel}>Account</Text>
        <Card padded={false}>
          <Row icon="person-outline" label="Display name" value={membership?.display_name ?? '—'} />
          <Divider style={{ marginLeft: 52 }} />
          <Row icon="shield-checkmark-outline" label="Role" value={membership?.role ?? '—'} capitalize />
        </Card>
      </View>

      <View style={styles.section}>
        <Button
          label="Sign out"
          variant="secondary"
          onPress={signOut}
          leadingIcon={<Ionicons name="log-out-outline" size={18} color={color.textPrimary} />}
        />
      </View>
    </Screen>
  );
}

function Row({
  icon,
  label,
  value,
  capitalize,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color={color.textSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="caption">{label}</Text>
        <Text
          variant="bodyStrong"
          style={capitalize ? { textTransform: 'capitalize' } : undefined}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

type NavRowProps = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  hint?: string;
  onPress?: () => void;
};

const NavRow = React.forwardRef<View, NavRowProps>(function NavRow(
  { icon, label, hint, onPress },
  ref,
) {
  return (
    <Pressable
      ref={ref as any}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color={color.textSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{label}</Text>
        {hint ? <Text variant="footnote">{hint}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={color.textTertiary} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  profile: {
    alignItems: 'center',
    paddingHorizontal: space.lg,
    gap: space.sm,
    paddingVertical: space.md,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: radius.full,
    backgroundColor: color.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  section: {
    paddingHorizontal: space.lg,
    gap: space.sm,
  },
  sectionLabel: {},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: color.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
