import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '@/components/ui';
import { formatMXN } from '@/domain/money';
import { fontWeight, radius, space } from '@/theme/tokens';

/**
 * Single hero card slot at the top of the komandas list. Two modes share
 * the same amber gradient + glow + stats grid — only the headline content
 * and the three stat slots swap by role.
 *
 *   mode: 'revenue' — admin/cashier. Money-forward: today's revenue + Open/Closed/Items sold.
 *   mode: 'shift'   — waiter. Money-free: greeting + their own Open/Closed/Items added.
 *
 * Replaces the prior RevenueCard + WaiterStatsCard pair so role-driven
 * surfaces share one component instead of forking palettes per role.
 */
export type StatsHeroProps =
  | {
      mode: 'revenue';
      dayRevenueCents: number;
      closedCount: number;
      activeCount: number;
      itemsSold: number;
      /** 'shift' shows "Current shift's revenue", 'day' shows "Day's revenue". */
      scope: 'shift' | 'day';
    }
  | {
      mode: 'shift';
      displayName: string | null;
      activeMine: number;
      oldestOpenAgeMs: number | null;
      closedToday: number;
      itemsAddedToday: number;
    };

export function StatsHeroCard(props: StatsHeroProps) {
  return (
    <View style={styles.pad}>
      <LinearGradient
        // Brand-amber gradient: Honey Glow → Amber Flame → deepest amber.
        // Same stops in both modes so role doesn't change the brand
        // expression — only the content shifts.
        colors={['#feab30', '#ff5b1f', '#7a1f00']}
        locations={[0, 0.45, 1]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={styles.card}
      >
        <View pointerEvents="none" style={styles.glow} />
        {/* iOS-only BlurView smears the highlight halo into a real glow.
            Android's UIVisualEffect equivalent doesn't capture sibling
            layers reliably so the disc is left as-is there. */}
        {Platform.OS === 'ios' ? (
          <BlurView
            tint="default"
            intensity={32}
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']}
          locations={[0, 0.45]}
          style={StyleSheet.absoluteFillObject}
        />
        {props.mode === 'revenue' ? (
          <RevenueHeader {...props} />
        ) : (
          <ShiftHeader {...props} />
        )}
        <View style={styles.stats}>
          {props.mode === 'revenue' ? (
            <>
              <HeroStat label="Open" value={props.activeCount} tint="#1a0a02" />
              <HeroStat label="Closed" value={props.closedCount} tint="#0d4a22" />
              <HeroStat label="Items sold" value={props.itemsSold} tint="#1a0a02" />
            </>
          ) : (
            <>
              <HeroStat label="Open" value={props.activeMine} tint="#1a0a02" />
              <HeroStat label="Closed today" value={props.closedToday} tint="#0d4a22" />
              <HeroStat label="Items added" value={props.itemsAddedToday} tint="#1a0a02" />
            </>
          )}
        </View>
      </LinearGradient>
    </View>
  );
}

function RevenueHeader({
  dayRevenueCents,
  closedCount,
  scope,
}: {
  dayRevenueCents: number;
  closedCount: number;
  scope: 'shift' | 'day';
}) {
  const label = scope === 'shift' ? "Current shift's revenue" : "Day's revenue";
  return (
    <>
      <Text style={styles.eyebrow}>{label}</Text>
      <Text mono style={styles.money}>
        {formatMXN(dayRevenueCents)}
      </Text>
      <Text style={styles.subtitle}>
        from {closedCount} closed komanda{closedCount === 1 ? '' : 's'}
      </Text>
    </>
  );
}

function ShiftHeader({
  displayName,
  activeMine,
  oldestOpenAgeMs,
}: {
  displayName: string | null;
  activeMine: number;
  oldestOpenAgeMs: number | null;
}) {
  const firstName = (displayName ?? '').split(/\s+/)[0] || 'there';
  const oldest = formatAge(oldestOpenAgeMs);
  return (
    <>
      <Text style={styles.eyebrow}>Your shift</Text>
      <Text style={styles.greeting}>Hi, {firstName}</Text>
      <Text style={styles.subtitle}>
        {activeMine === 0
          ? 'No open komandas right now.'
          : `${activeMine} open · oldest ${oldest}`}
      </Text>
    </>
  );
}

function HeroStat({
  label,
  value,
  tint,
}: {
  label: string;
  value: number;
  tint: string;
}) {
  return (
    <View style={styles.heroStat}>
      <BlurView
        tint="light"
        intensity={60}
        style={StyleSheet.absoluteFillObject}
        experimentalBlurMethod="dimezisBlurView"
      />
      <Text mono style={[styles.heroStatValue, { color: tint }]}>
        {value}
      </Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

function formatAge(ms: number | null): string {
  if (ms == null) return '—';
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remMin = minutes % 60;
  if (hours < 24) return remMin === 0 ? `${hours}h` : `${hours}h ${remMin}m`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

const styles = StyleSheet.create({
  pad: {
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  card: {
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
  glow: {
    position: 'absolute',
    width: 280,
    height: 280,
    right: -110,
    top: -110,
    borderRadius: 140,
    backgroundColor: 'rgba(255,237,200,0.55)',
  },
  // Top stops are bright amber. Light text washes out there so headlines
  // + numbers sit on deep warm near-black. Stats sit at the deep-amber
  // bottom where the same dark text reads cleanly against the lighter
  // BlurView pad.
  eyebrow: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: 'rgba(42,13,0,0.78)',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  money: {
    marginTop: 4,
    fontSize: 38,
    lineHeight: 42,
    fontWeight: fontWeight.heavy,
    color: '#1a0a02',
    letterSpacing: -0.8,
  },
  greeting: {
    marginTop: 4,
    fontSize: 32,
    lineHeight: 36,
    fontWeight: fontWeight.heavy,
    color: '#1a0a02',
    letterSpacing: -0.6,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: 'rgba(42,13,0,0.72)',
  },
  stats: {
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
    borderColor: 'rgba(42,13,0,0.22)',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,237,200,0.28)',
  },
  heroStatValue: {
    fontSize: 22,
    lineHeight: 26,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.3,
  },
  heroStatLabel: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: fontWeight.medium,
    color: 'rgba(42,13,0,0.72)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});
