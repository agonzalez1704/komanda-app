import type { ReactNode } from 'react';
import {
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { glass, radius as radiusTokens } from '@/theme/tokens';

type Variant = 'light' | 'dark' | 'primary';

export type GlassSurfaceProps = {
  children?: ReactNode;
  variant?: Variant;
  /** Corner radius. Defaults to `radius.xxl` (concentric with the iPhone frame). */
  radius?: number;
  /** Optional shadow — enabled by default for floating bars. */
  floating?: boolean;
  /** Drop the specular highlight (e.g. when the surface butts against a safe area). */
  noSpecular?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Applied to the inner content wrapper (padding, flex layout, etc). */
  contentStyle?: StyleProp<ViewStyle>;
  /** Force-disable the BlurView (tests, Jest, low-end devices). */
  disableBlur?: boolean;
};

/**
 * Liquid Glass primitive — a floating translucent surface used for navigation
 * bars, segmented controls, search bars, action bars, and FABs.
 *
 * Composition:
 *   1. BlurView            — the actual backdrop blur / saturate
 *   2. Overlay wash        — a semi-transparent warm or dark tint that gives
 *                            the glass a color cast and lifts content contrast
 *   3. Specular highlight  — a 1px top-inset line of near-white (the gloss)
 *   4. Border              — a 1px hairline that reads like the edge of glass
 *
 * Use this ONLY for chrome. Content (cards, list rows, receipts) should stay
 * on solid surfaces — that's Apple's own guidance for iOS 26 and it's what
 * keeps the palette readable at a glance.
 */
export function GlassSurface({
  children,
  variant = 'light',
  radius = radiusTokens.xxl,
  floating = true,
  noSpecular = false,
  style,
  contentStyle,
  disableBlur = false,
}: GlassSurfaceProps) {
  const g = glass[variant];
  const blurIntensity = g.intensity;
  // Web and Jest don't render BlurView usefully — fall back to the overlay
  // color which is tuned to look credible without the blur layer.
  const shouldBlur = !disableBlur && Platform.OS !== 'web';

  return (
    <View
      style={[
        styles.wrap,
        { borderRadius: radius, borderColor: g.border },
        floating && g.shadow,
        style,
      ]}
    >
      {shouldBlur ? (
        <BlurView
          tint={g.tint}
          intensity={blurIntensity}
          style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
        />
      ) : null}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: g.overlay, borderRadius: radius },
        ]}
      />
      {!noSpecular ? (
        <View
          pointerEvents="none"
          style={[
            styles.specular,
            {
              borderRadius: radius,
              borderTopColor: g.specular,
            },
          ]}
        />
      ) : null}
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  specular: {
    ...StyleSheet.absoluteFillObject,
    borderTopWidth: 1,
  },
  content: { position: 'relative', zIndex: 1 },
});
