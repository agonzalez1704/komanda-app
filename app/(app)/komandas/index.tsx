import { KomandaCard } from '@/components/KomandaCard';
import { StuckMutationsBanner } from '@/components/StuckMutationsBanner';
import {
  EmptyState,
  GlassSurface,
  IconButton,
  Screen,
  Text,
  TextField,
} from '@/components/ui';
import { formatMXN } from '@/domain/money';
import { calculateTotal } from '@/domain/total';
import { fetchItemsForKomanda, fetchKomandasForDate } from '@/insforge/queries/komandas';
import {
  color,
  fontWeight,
  hitSlop,
  palette,
  radius,
  space,
} from '@/theme/tokens';
import { Ionicons } from '@expo/vector-icons';
import { useQueries, useQuery } from '@tanstack/react-query';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

type FilterKey = 'all' | 'active' | 'closed';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'all', label: 'All' },
  { key: 'closed', label: 'Closed' },
];

export default function KomandasList() {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['komandas', 'today'],
    queryFn: () => fetchKomandasForDate(today),
    staleTime: 1000 * 10,
  });
  // We track manual pull-to-refresh separately from `isRefetching` so that
  // background refetches (e.g. when the offline drain invalidates after a
  // successful sync) don't make the spinner toggle on every drain tick.
  const [manualRefreshing, setManualRefreshing] = useState(false);
  async function onPullRefresh() {
    setManualRefreshing(true);
    try {
      await refetch();
    } finally {
      setManualRefreshing(false);
    }
  }

  const [filter, setFilter] = useState<FilterKey>('active');
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');

  const komandas = data ?? [];
  const filtered = useMemo(() => {
    const byStatus =
      filter === 'all'
        ? komandas
        : filter === 'closed'
          ? komandas.filter((k) => k.status === 'closed')
          : komandas.filter((k) => k.status !== 'closed');
    const q = search.trim().toLowerCase();
    if (!q) return byStatus;
    return byStatus.filter((k) => {
      const number = (k.number ?? '').toLowerCase();
      const name = (k.display_name ?? '').toLowerCase();
      return number.includes(q) || name.includes(q);
    });
  }, [komandas, filter, search]);

  // Pull item counts/totals for each komanda in a single shot
  const itemQueries = useQueries({
    queries: komandas.map((k) => ({
      queryKey: ['komanda', k.id, 'items'],
      queryFn: () => fetchItemsForKomanda(k.id),
      enabled: k.number !== null,
      staleTime: 1000 * 10,
    })),
  });
  const byId = useMemo(() => {
    const m = new Map<string, { count: number; total: number }>();
    komandas.forEach((k, idx) => {
      const items = itemQueries[idx]?.data ?? [];
      const count = items.reduce((acc, it) => acc + it.quantity, 0);
      m.set(k.id, { count, total: calculateTotal(items) });
    });
    return m;
  }, [komandas, itemQueries]);

  const totals = useMemo(() => {
    const counts = { all: 0, active: 0, closed: 0 };
    let dayRevenue = 0;
    let itemsSold = 0;
    for (const k of komandas) {
      counts.all += 1;
      if (k.status === 'closed') {
        counts.closed += 1;
        dayRevenue += k.total_cents ?? 0;
        const stats = byId.get(k.id);
        if (stats) itemsSold += stats.count;
      } else {
        counts.active += 1;
      }
    }
    return { ...counts, dayRevenue, itemsSold };
  }, [komandas, byId]);

  const dateLabel = useMemo(() => formatDateLong(today), [today]);

  function goNew() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    router.push('/(app)/komandas/new');
  }

  // Liquid Glass: the warm canvas paints behind the whole screen. The
  // top-of-screen nav and the filter segmented-control are glass chrome that
  // refract whatever is underneath. Content (the list itself) stays solid.
  return (
    <Screen padded={false} edges={['top']} floatingFooter>
      {/* ------------------------------------------------------------------ */}
      {/* Floating glass nav pill — search icon (left), centered title stack */}
      {/* (Komandas / date), settings icon (right). Mirrors the layout in    */}
      {/* design/revamp-preview.html's `.topbar-float`.                      */}
      {/* ------------------------------------------------------------------ */}
      <View style={styles.topBarPad}>
        <GlassSurface radius={radius.xxl} contentStyle={styles.topBarInner}>
          <IconButton
            glass
            name={searchOpen ? 'close' : 'search-outline'}
            accessibilityLabel={searchOpen ? 'Close search' : 'Search komandas'}
            onPress={() => {
              setSearchOpen((v) => {
                if (v) setSearch('');
                return !v;
              });
            }}
          />
          {/* Center block — mirrors `.topbar-float .center` in the
              revamp-preview: "Komandas" as the primary label (15px semibold),
              date underneath as 11px secondary. Center-aligned so the two
              icon wells flank it symmetrically. */}
          <View style={styles.topBarCenter}>
            <Text
              numberOfLines={1}
              style={{
                fontSize: 15,
                lineHeight: 18,
                fontWeight: fontWeight.semibold,
                color: color.textPrimary,
                letterSpacing: -0.1,
                textAlign: 'center',
              }}
            >
              Komandas
            </Text>
            <Text
              numberOfLines={1}
              style={{
                fontSize: 11,
                lineHeight: 14,
                color: color.textSecondary,
                marginTop: 1,
                textAlign: 'center',
              }}
            >
              {dateLabel}
            </Text>
          </View>
          <IconButton
            glass
            name="settings-outline"
            accessibilityLabel="Settings"
            onPress={() => router.push('/(app)/settings')}
          />
        </GlassSurface>
      </View>

      {/* Collapsible search — solid TextField (content, not chrome). */}
      {searchOpen ? (
        <View style={styles.searchPad}>
          <TextField
            placeholder="Search by number or table label"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            autoFocus
            leading={
              <Ionicons
                name="search"
                size={18}
                color={color.textTertiary}
              />
            }
            trailing={
              search ? (
                <Pressable
                  onPress={() => setSearch('')}
                  hitSlop={hitSlop}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                >
                  <Ionicons
                    name="close-circle"
                    size={18}
                    color={color.textTertiary}
                  />
                </Pressable>
              ) : null
            }
          />
        </View>
      ) : null}

      {/* Summary Stats */}
      {!isLoading && komandas.length > 0 ? (
        <View style={styles.revenuePad}>
          <LinearGradient
            colors={['#241812', '#1C1410', '#140D09']}
            locations={[0, 0.55, 1]}
            start={{ x: 0.15, y: 0 }}
            end={{ x: 0.85, y: 1 }}
            style={styles.revenueCard}
          >
            {/* Saffron glow — mimics the CSS ::before radial */}
            <View pointerEvents="none" style={styles.revenueGlow} />
            {/* Specular sheen on top edge */}
            <LinearGradient
              pointerEvents="none"
              colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0)']}
              locations={[0, 0.4]}
              style={StyleSheet.absoluteFillObject}
            />
            <Text
              style={{
                fontSize: 11,
                fontWeight: fontWeight.bold,
                color: palette.saffron500,
                textTransform: 'uppercase',
                letterSpacing: 1.2,
              }}
            >
              Today&rsquo;s revenue
            </Text>
            <Text
              mono
              style={{
                marginTop: 4,
                fontSize: 38,
                lineHeight: 42,
                fontWeight: fontWeight.heavy,
                color: '#FFFFFF',
                letterSpacing: -0.8,
              }}
            >
              {formatMXN(totals.dayRevenue)}
            </Text>
            <Text
              style={{
                marginTop: 4,
                fontSize: 13,
                color: 'rgba(255,255,255,0.72)',
              }}
            >
              from {totals.closed} closed komanda{totals.closed === 1 ? '' : 's'}
            </Text>
            <View style={styles.revStats}>
              <HeroStat label="Open" value={totals.active} tint={palette.saffron500} />
              <HeroStat label="Closed" value={totals.closed} tint="#8AE0A2" />
              <HeroStat label="Items sold" value={totals.itemsSold} tint="#FFFFFF" />
            </View>
          </LinearGradient>
        </View>
      ) : null}

      {!isLoading && komandas.length > 0 ? (
        <View style={styles.filterPad}>
          <GlassSurface radius={radius.full} contentStyle={styles.segment}>
            {FILTERS.map((f, idx) => (
              <FilterTab
                key={f.key}
                label={f.label}
                count={totals[f.key]}
                active={filter === f.key}
                onPress={() => setFilter(f.key)}
                isFirst={idx === 0}
                isLast={idx === FILTERS.length - 1}
              />
            ))}
          </GlassSurface>
        </View>
      ) : null}

      <StuckMutationsBanner />

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={color.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(k) => k.id}
          contentContainerStyle={styles.list}
          refreshing={manualRefreshing}
          onRefresh={onPullRefresh}
          ListEmptyComponent={
            <EmptyState
              icon="receipt-outline"
              title={emptyTitleFor(filter, komandas.length)}
              subtitle={emptySubtitleFor(filter, komandas.length)}
            />
          }
          renderItem={({ item }) => {
            const stats = byId.get(item.id) ?? { count: 0, total: 0 };
            return (
              <KomandaCard
                k={item}
                itemCount={stats.count}
                runningTotalCents={
                  item.status === 'closed' ? item.total_cents ?? stats.total : stats.total
                }
                onPress={() => router.push(`/(app)/komandas/${item.id}`)}
                syncedServerSide={item.number !== null}
              />
            );
          }}
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Glass-tinted floating "New" FAB — concentric capsule, specular      */}
      {/* highlight, warm terracotta wash.                                    */}
      {/* ------------------------------------------------------------------ */}
      <View style={styles.fabWrap} pointerEvents="box-none">
        <GlassSurface variant="primary" radius={radius.full}>
          <Pressable
            onPress={goNew}
            accessibilityRole="button"
            accessibilityLabel="New komanda"
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
              New komanda
            </Text>
          </Pressable>
        </GlassSurface>
      </View>
    </Screen>
  );
}

function HeroStat({ label, value, tint }: { label: string; value: number; tint: string }) {
  return (
    <View style={styles.heroStat}>
      <BlurView tint="dark" intensity={24} style={StyleSheet.absoluteFillObject} />
      <View style={styles.heroStatOverlay} pointerEvents="none" />
      <Text
        mono
        style={{
          fontSize: 22,
          lineHeight: 26,
          fontWeight: fontWeight.bold,
          color: tint,
          letterSpacing: -0.3,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          marginTop: 2,
          fontSize: 11,
          fontWeight: fontWeight.medium,
          color: 'rgba(255,255,255,0.72)',
          letterSpacing: 0.6,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function FilterTab({
  label,
  count,
  active,
  onPress,
  isFirst,
  isLast,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => { });
        onPress();
      }}
      accessibilityRole="tab"
      accessibilityLabel={`${label}, ${count} ${count === 1 ? 'komanda' : 'komandas'}`}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.filterTab,
        isFirst && { borderTopLeftRadius: radius.full, borderBottomLeftRadius: radius.full },
        isLast && { borderTopRightRadius: radius.full, borderBottomRightRadius: radius.full },
        active && styles.filterTabActive,
        pressed && !active && { opacity: 0.85 },
      ]}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: fontWeight.semibold,
          color: active ? color.textPrimary : color.textSecondary,
        }}
      >
        {label}
      </Text>
      <View
        style={[styles.filterCount, active && styles.filterCountActive]}
        importantForAccessibility="no"
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: fontWeight.bold,
            color: active ? palette.terracotta600 : color.textSecondary,
            fontVariant: ['tabular-nums'],
          }}
        >
          {count}
        </Text>
      </View>
    </Pressable>
  );
}

function emptyTitleFor(filter: FilterKey, total: number): string {
  if (total === 0) return 'No komandas yet today';
  if (filter === 'closed') return 'Nothing closed yet';
  if (filter === 'active') return 'All caught up';
  return 'No komandas match';
}

function emptySubtitleFor(filter: FilterKey, total: number): string {
  if (total === 0) return 'Tap the button below to open your first order.';
  if (filter === 'closed') return 'Close a komanda to see it appear here.';
  if (filter === 'active') return 'Every komanda has been closed. Nice work.';
  return 'Try a different filter or open a new komanda.';
}

function formatDateLong(d: Date): string {
  try {
    return d.toLocaleDateString(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  } catch {
    return d.toDateString();
  }
}

const styles = StyleSheet.create({
  // Floating top nav pill — inset from the edges so the WarmCanvas blurs
  // through the rounded corners.
  topBarPad: {
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
    paddingBottom: space.sm,
  },
  topBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: 56,
  },
  // Mirrors `.topbar-float .center` — flex:1, text-align:center, min-width:0
  // so the label truncates gracefully inside the pill.
  topBarCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 0,
  },

  // Collapsible search row — solid content, sits under the glass nav pill.
  searchPad: {
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
  },

  revenuePad: {
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  revenueCard: {
    borderRadius: radius.xl,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 20,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 6,
  },
  revenueGlow: {
    position: 'absolute',
    width: 240,
    height: 240,
    right: -90,
    top: -90,
    borderRadius: 120,
    backgroundColor: 'rgba(244,168,32,0.18)',
  },
  revStats: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 18,
  },
  heroStat: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
  },
  heroStatOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  filterPad: {
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
  },
  segment: {
    flexDirection: 'row',
    padding: 4,
    gap: 2,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: space.md,
    borderRadius: radius.full,
    backgroundColor: 'transparent',
  },
  filterTabActive: {
    backgroundColor: color.primary,
  },
  filterCount: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.full,
    backgroundColor: 'rgba(28,20,16,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterCountActive: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },

  list: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: 120,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Floating glass-tinted FAB. `GlassSurface` owns the shadow + specular —
  // this wrapper just handles positioning and tap layout.
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
