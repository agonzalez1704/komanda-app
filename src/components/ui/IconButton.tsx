import { color, hitSlop, icon as iconSize, layout, radius } from '@/theme/tokens';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export type IconButtonProps = Omit<PressableProps, 'style'> & {
  name: IconName;
  size?: keyof typeof iconSize;
  tint?: string;
  /** Adds a circular background. */
  filled?: boolean;
  background?: string;
  /**
   * Glass-bead look — a 40x40 circle with a translucent white fill and a
   * 1px inset-style top highlight. Matches the `.icon-glass` pattern from
   * design/revamp-preview.html. Use when an IconButton lives inside a
   * GlassSurface nav pill so it reads as a small glass well.
   */
  glass?: boolean;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
};

export function IconButton({
  name,
  size = 'lg',
  tint = color.textPrimary,
  filled = false,
  background = color.surfaceAlt,
  glass = false,
  onPress,
  style,
  accessibilityLabel,
  ...rest
}: IconButtonProps) {
  return (
    <Pressable
      {...rest}
      hitSlop={hitSlop}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={(e) => {
        Haptics.selectionAsync().catch(() => { });
        onPress?.(e);
      }}
      style={({ pressed }) => [
        styles.btn,
        filled && { backgroundColor: background, borderRadius: radius.full },
        glass && styles.glass,
        pressed && { opacity: 0.6 },
        style,
      ]}
    >
      <Ionicons name={name} size={iconSize[size]} color={tint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    minWidth: layout.minTouchTarget,
    minHeight: layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Mirrors `.icon-glass` from revamp-preview.html — a small translucent
  // white bead that reads as a sibling well inside a larger glass pill.
  // The hairline top border stands in for the CSS `inset 0 1px 0 ...` gloss
  // (React Native has no inset box-shadow).
  glass: {
    width: 50,
    height: 50,
    minWidth: 50,
    minHeight: 50,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.85)',
  },
});
