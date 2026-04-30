import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '@/components/ui';
import { fontWeight, palette, radius, space } from '@/theme/tokens';

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

export function WaiterStatsCard({
  displayName,
  activeMine,
  oldestOpenAgeMs,
  closedToday,
  itemsAddedToday,
}: {
  displayName: string | null;
  activeMine: number;
  oldestOpenAgeMs: number | null;
  closedToday: number;
  itemsAddedToday: number;
}) {
  const firstName = (displayName ?? '').split(/\s+/)[0] || 'there';
  const oldest = formatAge(oldestOpenAgeMs);
  return (
    <View style={styles.pad}>
      <LinearGradient
        colors={['#241812', '#1C1410', '#140D09']}
        locations={[0, 0.55, 1]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={styles.card}
      >
        <View pointerEvents="none" style={styles.glow} />
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0)']}
          locations={[0, 0.4]}
          style={StyleSheet.absoluteFillObject}
        />
        <Text style={styles.eyebrow}>Your shift</Text>
        <Text style={styles.greeting}>Hi, {firstName}</Text>
        <Text style={styles.subtitle}>
          {activeMine === 0
            ? 'No open komandas right now.'
            : `${activeMine} open · oldest ${oldest}`}
        </Text>
        <View style={styles.stats}>
          <HeroStat label="Open" value={activeMine} tint={palette.saffron500} />
          <HeroStat label="Closed today" value={closedToday} tint="#8AE0A2" />
          <HeroStat label="Items added" value={itemsAddedToday} tint="#FFFFFF" />
        </View>
      </LinearGradient>
    </View>
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
    width: 240,
    height: 240,
    right: -90,
    top: -90,
    borderRadius: 120,
    backgroundColor: 'rgba(244,168,32,0.18)',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: palette.saffron500,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  greeting: {
    marginTop: 4,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: fontWeight.heavy,
    color: '#FFFFFF',
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: 'rgba(255,255,255,0.72)',
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
    borderColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
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
    color: 'rgba(255,255,255,0.72)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});
