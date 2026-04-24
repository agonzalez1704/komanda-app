import { Pressable, StyleSheet, View, type PressableProps, type ViewStyle, type StyleProp } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Text } from './Text';
import { color, fontSize, fontWeight, radius, space } from '@/theme/tokens';

export type ChipProps = Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  /** Use a block (full-width, equal flex) layout. */
  block?: boolean;
  leadingIcon?: React.ReactNode;
  tone?: 'neutral' | 'primary';
  style?: StyleProp<ViewStyle>;
};

export function Chip({
  label,
  selected = false,
  disabled = false,
  block = false,
  leadingIcon,
  tone = 'primary',
  onPress,
  style,
  ...rest
}: ChipProps) {
  const palette = selected
    ? tone === 'primary'
      ? { bg: color.primary, border: color.primary, text: color.primaryOn }
      : { bg: color.textPrimary, border: color.textPrimary, text: color.textInverse }
    : { bg: color.surface, border: color.border, text: color.textPrimary };

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      onPress={(e) => {
        if (disabled) return;
        Haptics.selectionAsync().catch(() => {});
        onPress?.(e);
      }}
      style={({ pressed }) => [
        styles.chip,
        { backgroundColor: palette.bg, borderColor: palette.border },
        block && styles.block,
        pressed && !disabled && { opacity: 0.85 },
        disabled && { opacity: 0.45 },
        style,
      ]}
    >
      <View style={styles.row}>
        {leadingIcon ? <View>{leadingIcon}</View> : null}
        <Text
          style={{
            color: palette.text,
            fontSize: fontSize.body,
            fontWeight: selected ? fontWeight.semibold : fontWeight.medium,
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  block: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: space.md,
  },
});
