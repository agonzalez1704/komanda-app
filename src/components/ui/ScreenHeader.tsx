import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { color, hitSlop, icon as iconSize, layout, space } from '@/theme/tokens';

export type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  /** Show an iOS-style back chevron. Uses expo-router `router.back()`. */
  showBack?: boolean;
  /** Custom left node (overrides showBack). */
  left?: ReactNode;
  /** Right-side action slot. */
  right?: ReactNode;
  /** Align title left (default) or center. */
  align?: 'left' | 'center';
};

export function ScreenHeader({
  title,
  subtitle,
  showBack = false,
  left,
  right,
  align = 'left',
}: ScreenHeaderProps) {
  const router = useRouter();

  const leftNode = left ? (
    left
  ) : showBack ? (
    <Pressable
      onPress={() => router.back()}
      hitSlop={hitSlop}
      style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
      accessibilityRole="button"
      accessibilityLabel="Back"
    >
      <Ionicons name="chevron-back" size={iconSize.lg} color={color.textPrimary} />
    </Pressable>
  ) : null;

  return (
    <View style={styles.wrap}>
      <View style={styles.slot}>{leftNode}</View>
      <View
        style={[
          styles.center,
          align === 'center' && { alignItems: 'center' },
          align === 'left' && { alignItems: 'flex-start', paddingLeft: leftNode ? space.sm : 0 },
        ]}
      >
        <Text variant="h2" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="footnote" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={[styles.slot, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: layout.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.sm,
    gap: space.sm,
  },
  slot: {
    minWidth: layout.minTouchTarget,
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
  },
  iconBtn: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
});
