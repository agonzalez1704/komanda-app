import { Redirect, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { fetchMyMembership } from '@/insforge/queries/membership';
import { listCombos } from '@/insforge/queries/combos';
import { ComboCard } from '@/features/menu/components/ComboCard';
import { can } from '@/auth/permissions';
import {
  EmptyState,
  GlassSurface,
  IconButton,
  Screen,
  Text,
} from '@/components/ui';
import { color, fontWeight, radius, space } from '@/theme/tokens';

export default function CombosListScreen() {
  const router = useRouter();
  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ['membership'],
    queryFn: fetchMyMembership,
  });
  const orgId = me?.org_id ?? '';
  const list = useQuery({
    queryKey: ['combos', orgId],
    queryFn: () => listCombos(orgId),
    enabled: !!orgId,
  });

  if (me && !can.manageMenu(me.role)) {
    return <Redirect href="/(app)/komandas" />;
  }

  const combos = list.data ?? [];
  const totalCount = combos.length;
  const hiddenCount = combos.filter((c) => !c.active).length;
  const subtitle = totalCount
    ? `${totalCount} combo${totalCount === 1 ? '' : 's'}${
        hiddenCount > 0 ? ` · ${hiddenCount} hidden` : ''
      }`
    : null;

  function goNew() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push('/(app)/menu/combos/new' as any);
  }

  return (
    <Screen padded={false} edges={['top']} floatingFooter>
      <View style={styles.hdrPad}>
        <GlassSurface radius={radius.xxl} contentStyle={styles.hdrInner}>
          <IconButton
            glass
            name="chevron-back"
            onPress={() => router.back()}
            accessibilityLabel="Back"
          />
          <View style={{ flex: 1, paddingLeft: space.xs }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: fontWeight.bold,
                color: color.textTertiary,
                textTransform: 'uppercase',
                letterSpacing: 0.8,
              }}
            >
              Menu
            </Text>
            <Text variant="h3" numberOfLines={1}>
              Combos
            </Text>
          </View>
        </GlassSurface>
      </View>

      {subtitle ? (
        <View style={styles.metaPad}>
          <Text variant="footnote" style={{ color: color.textSecondary }}>
            {subtitle}
          </Text>
        </View>
      ) : null}

      {meLoading || list.isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={color.primary} />
        </View>
      ) : (
        <FlatList
          data={combos}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              icon="layers-outline"
              title="No combos yet"
              subtitle="Bundle products together at a fixed price."
            />
          }
          renderItem={({ item }) => (
            <ComboCard
              combo={item}
              itemCount={0}
              onPress={() =>
                router.push(`/(app)/menu/combos/${item.id}` as any)
              }
            />
          )}
        />
      )}

      <View style={styles.fabWrap} pointerEvents="box-none">
        <GlassSurface variant="primary" radius={radius.full}>
          <Pressable
            onPress={goNew}
            accessibilityRole="button"
            accessibilityLabel="New combo"
            android_ripple={{ color: 'rgba(255,255,255,0.18)' }}
            style={({ pressed }) => [
              styles.fabInner,
              pressed && { opacity: 0.92, transform: [{ scale: 0.97 }] },
            ]}
          >
            <Ionicons name="add" size={22} color={color.primaryOn} />
            <Text
              style={{
                color: color.primaryOn,
                fontWeight: fontWeight.semibold,
                fontSize: 16,
              }}
            >
              New combo
            </Text>
          </Pressable>
        </GlassSurface>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hdrPad: {
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
    paddingBottom: space.sm,
  },
  hdrInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    minHeight: 60,
  },
  metaPad: {
    paddingHorizontal: space.xl,
    paddingBottom: space.xs,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
    paddingBottom: 120,
    gap: space.sm,
  },
  fabWrap: {
    position: 'absolute',
    right: space.lg,
    bottom: space.xl,
  },
  fabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    minHeight: 52,
  },
});
