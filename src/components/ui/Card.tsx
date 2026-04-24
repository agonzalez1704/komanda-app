import { StyleSheet, View, type ViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { color, radius, shadow, space } from '@/theme/tokens';

export type CardProps = ViewProps & {
  padded?: boolean;
  elevation?: 'none' | 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
};

export function Card({
  padded = true,
  elevation = 'sm',
  style,
  children,
  ...rest
}: CardProps) {
  const elev = elevation === 'none' ? null : elevation === 'md' ? shadow.md : shadow.sm;
  return (
    <View
      {...rest}
      style={[styles.card, padded && styles.padded, elev, style]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  padded: {
    padding: space.lg,
  },
});
