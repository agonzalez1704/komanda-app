import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from '@/components/ui';
import { formatMXN } from '@/domain/money';
import { fontWeight, radius, space } from '@/theme/tokens';

export function RevenueCard({
  dayRevenueCents,
  closedCount,
  activeCount,
  itemsSold,
}: {
  dayRevenueCents: number;
  closedCount: number;
  activeCount: number;
  itemsSold: number;
}) {
  return (
    <View style={styles.pad}>
      <LinearGradient
        // Brand-amber gradient: Honey Glow → Amber Flame → deepest amber.
        // The hero "today's revenue" card carries the brand color so the
        // money number IS the brand expression. Replaces the previous
        // brown-coffee gradient that read as muddy / non-vivid.
        colors={['#feab30', '#ff5b1f', '#7a1f00']}
        locations={[0, 0.45, 1]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={styles.card}
      >
        <View pointerEvents="none" style={styles.glow} />
        {/* Smear the highlight halo into a real radial glow. Same trick as
            WarmCanvas: a fullscreen BlurView captures whatever is drawn
            beneath it (the amber gradient + the hard-edged glow disc)
            and outputs a soft wash. Without this the glow renders as a
            crisp colored circle, not a glow. iOS only — Android's
            UIVisualEffect equivalent doesn't capture sibling layers
            reliably so we leave the disc as-is there. */}
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
        <Text style={styles.eyebrow}>Today&rsquo;s revenue</Text>
        <Text mono style={styles.money}>
          {formatMXN(dayRevenueCents)}
        </Text>
        <Text style={styles.subtitle}>
          from {closedCount} closed komanda{closedCount === 1 ? '' : 's'}
        </Text>
        <View style={styles.stats}>
          <HeroStat label="Open" value={activeCount} tint="#1a0a02" />
          <HeroStat label="Closed" value={closedCount} tint="#0d4a22" />
          <HeroStat label="Items sold" value={itemsSold} tint="#1a0a02" />
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
    width: 280,
    height: 280,
    right: -110,
    top: -110,
    borderRadius: 140,
    // Bright white-honey halo blooms in the top-right corner — reads as
    // sunlight catching the amber face of the card after the BlurView
    // smears it.
    backgroundColor: 'rgba(255,237,200,0.55)',
  },
  // Top of card sits over Honey Glow → bright amber. White washes out
  // there, so headlines + money use a deep warm near-black for AAA
  // contrast against the bright gradient stops. Stats live at the
  // bottom (deep amber) where light text reads cleanly.
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
