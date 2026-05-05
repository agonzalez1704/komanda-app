import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui';
import { color, fontWeight, palette, radius, space } from '@/theme/tokens';

export type SwipeActionTone = 'info' | 'danger' | 'success' | 'primary';

const TONE_BG: Record<SwipeActionTone, string> = {
  info: palette.info500,
  danger: palette.danger500,
  success: palette.success500,
  primary: palette.terracotta500,
};

/**
 * Liquid-glass swipe action — solid colored disc with white glyph and
 * label below, matching iOS 26 Mail.app's swipe vocabulary. Pops in with
 * a staggered scale + opacity tied to the swipe progress so the actions
 * feel summoned by the gesture rather than statically rendered behind it.
 *
 * Designed to be rendered inside `ReanimatedSwipeable`'s renderRightActions
 * (or renderLeftActions) — the parent passes the `progress` SharedValue
 * along with the action's `order` (zero-indexed left-to-right).
 */
export function SwipeAction({
  progress,
  order,
  onPress,
  label,
  icon,
  tone,
  accessibilityLabel,
}: {
  progress: SharedValue<number>;
  order: number;
  onPress: () => void;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: SwipeActionTone;
  accessibilityLabel: string;
}) {
  const animated = useAnimatedStyle(() => {
    const start = order * 0.18;
    const end = Math.min(1, start + 0.55);
    const t = interpolate(progress.value, [start, end], [0, 1], 'clamp');
    const scale = interpolate(t, [0, 0.7, 1], [0.4, 1.04, 1]);
    return {
      opacity: t,
      transform: [{ scale }],
    };
  }, [order]);

  return (
    <Animated.View style={[styles.slot, animated]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        android_ripple={{ color: 'rgba(255,255,255,0.25)', borderless: true }}
        hitSlop={8}
        style={({ pressed }) => [
          styles.pressable,
          pressed && { transform: [{ scale: 0.92 }] },
        ]}
      >
        <View style={[styles.disc, { backgroundColor: TONE_BG[tone] }]}>
          <Ionicons name={icon} size={18} color={color.primaryOn} />
        </View>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  slot: {
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressable: {
    alignItems: 'center',
    gap: 4,
  },
  disc: {
    width: 42,
    height: 42,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: palette.ink900,
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: fontWeight.semibold,
    color: color.textSecondary,
    letterSpacing: 0.2,
  },
});

export const swipeActionsWrapStyle = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: space.md,
    paddingRight: space.xs,
    gap: space.md,
  },
}).wrap;
