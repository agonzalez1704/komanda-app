import {
  Platform,
  StyleSheet,
  View,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { canvas } from '@/theme/tokens';

/**
 * Warm, brand-tinted backdrop for any screen that hosts Liquid Glass chrome.
 *
 * Layering (bottom → top):
 *   1. Vertical warm → linen → sand gradient sets the overall temperature.
 *   2. Four color "halos" (saffron, terracotta, jade) add brand richness.
 *   3. A fullscreen BlurView on iOS actually SMEARS those halos into soft
 *      radial glows — in React Native a plain `View` with borderRadius: 999
 *      renders hard-edged circles, not the soft gradients a CSS preview has.
 *      Without this step the halos read as crisp colored discs.
 *
 * Content (cards, text, buttons) renders ABOVE WarmCanvas, so it stays sharp
 * — the blur only affects the halos baked into the canvas itself.
 *
 * The component is `pointerEvents="none"` — it paints under everything but
 * never steals taps.
 */
export function WarmCanvas({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
      <LinearGradient
        colors={[canvas.topWarm, canvas.midLinen, canvas.bottomSand]}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
      />
      {/* Saffron halo — top right, radiates down. */}
      <View style={[styles.halo, styles.haloTopRight, { backgroundColor: canvas.haloSaffron }]} />
      {/* Terracotta halo — upper-left, softer. */}
      <View
        style={[styles.halo, styles.haloUpperLeft, { backgroundColor: canvas.haloTerracotta }]}
      />
      {/* Jade halo — bottom-right, keeps the warm field from feeling monotone. */}
      <View style={[styles.halo, styles.haloBottomRight, { backgroundColor: canvas.haloJade }]} />
      {/* Saffron soft — bottom-left, anchors FAB area with warmth. */}
      <View
        style={[styles.halo, styles.haloBottomLeft, { backgroundColor: canvas.haloSaffronSoft }]}
      />
      {/* Soft-wash BlurView — blurs the halos into real radial glows.
          iOS UIVisualEffectView captures what's behind it, so the halos
          below get smeared while anything rendered ABOVE the canvas (the
          screen content) stays pin-sharp. Android and web degrade to the
          sharp halos, which still read OK on those platforms. */}
      {Platform.OS === 'ios' ? (
        <BlurView
          tint="light"
          intensity={55}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  halo: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 1,
  },
  // Each halo uses a wide, round View. The BlurView above washes them into
  // real radial glows — don't try to fake softness here with low alpha.
  haloTopRight: {
    top: -160,
    right: -120,
    width: 420,
    height: 380,
  },
  haloUpperLeft: {
    top: 40,
    left: -180,
    width: 400,
    height: 360,
  },
  haloBottomRight: {
    bottom: -80,
    right: -140,
    width: 480,
    height: 420,
  },
  haloBottomLeft: {
    bottom: -140,
    left: -100,
    width: 460,
    height: 380,
  },
});
