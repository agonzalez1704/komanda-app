import { useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Text } from './Text';
import { color, radius, space, layout, fontWeight, fontSize } from '@/theme/tokens';

type Variant = 'primary' | 'secondary' | 'ghost' | 'destructive';
type Size = 'md' | 'lg';

export type ButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  /** Rendered to the left of the label. */
  leadingIcon?: React.ReactNode;
  /** Rendered to the right of the label. */
  trailingIcon?: React.ReactNode;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  leadingIcon,
  trailingIcon,
  variant = 'primary',
  size = 'lg',
  loading = false,
  disabled = false,
  fullWidth = true,
  haptic = true,
  onPress,
  style,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const handlePress = useCallback(
    (e: any) => {
      if (isDisabled) return;
      if (haptic) {
        Haptics.selectionAsync().catch(() => {});
      }
      onPress?.(e);
    },
    [isDisabled, haptic, onPress],
  );

  const palette = getPalette(variant);
  const heightStyle = size === 'lg' ? { height: layout.buttonHeight } : { height: layout.buttonHeightSm };
  const textColor = palette.text;
  const spinnerColor = variant === 'primary' || variant === 'destructive' ? color.textInverse : color.primary;

  return (
    <Pressable
      {...rest}
      disabled={isDisabled}
      onPress={handlePress}
      android_ripple={{ color: palette.ripple, borderless: false }}
      style={({ pressed }) => [
        styles.base,
        heightStyle,
        { backgroundColor: palette.bg, borderColor: palette.border },
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && { opacity: 0.85, transform: [{ scale: 0.985 }] },
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <View style={styles.content}>
          {leadingIcon ? <View style={styles.icon}>{leadingIcon}</View> : null}
          <Text
            style={[
              styles.label,
              {
                color: textColor,
                fontSize: size === 'lg' ? fontSize.bodyLg : fontSize.body,
                fontWeight: fontWeight.semibold,
              },
            ]}
          >
            {label}
          </Text>
          {trailingIcon ? <View style={styles.icon}>{trailingIcon}</View> : null}
        </View>
      )}
    </Pressable>
  );
}

function getPalette(variant: Variant) {
  switch (variant) {
    case 'primary':
      return {
        bg: color.primary,
        border: color.primary,
        text: color.primaryOn,
        ripple: 'rgba(255,255,255,0.18)',
      };
    case 'secondary':
      return {
        bg: color.surface,
        border: color.borderStrong,
        text: color.textPrimary,
        ripple: 'rgba(28,20,16,0.06)',
      };
    case 'ghost':
      return {
        bg: 'transparent',
        border: 'transparent',
        text: color.primary,
        ripple: 'rgba(200,75,30,0.08)',
      };
    case 'destructive':
      return {
        bg: color.danger,
        border: color.danger,
        text: color.textInverse,
        ripple: 'rgba(255,255,255,0.18)',
      };
  }
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: space.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 88,
  },
  fullWidth: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  icon: { justifyContent: 'center', alignItems: 'center' },
  label: {},
  disabled: { opacity: 0.45 },
});
