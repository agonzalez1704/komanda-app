import { Pressable, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { GlassSurface, Text } from '@/components/ui';
import { color, fontWeight, palette, radius, space } from '@/theme/tokens';
import {
  KOMANDA_FILTERS,
  type FilterKey,
} from '../hooks/useKomandasFilter';
import type { KomandaTotals } from '../hooks/useKomandasTotals';

export function FilterBar({
  filter,
  onChange,
  totals,
}: {
  filter: FilterKey;
  onChange: (f: FilterKey) => void;
  totals: KomandaTotals;
}) {
  return (
    <View style={styles.pad}>
      <GlassSurface radius={radius.full} contentStyle={styles.segment}>
        {KOMANDA_FILTERS.map((f, idx) => (
          <FilterTab
            key={f.key}
            label={f.label}
            count={totals[f.key]}
            active={filter === f.key}
            onPress={() => onChange(f.key)}
            isFirst={idx === 0}
            isLast={idx === KOMANDA_FILTERS.length - 1}
          />
        ))}
      </GlassSurface>
    </View>
  );
}

function FilterTab({
  label,
  count,
  active,
  onPress,
  isFirst,
  isLast,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      accessibilityRole="tab"
      accessibilityLabel={`${label}, ${count} ${count === 1 ? 'komanda' : 'komandas'}`}
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.tab,
        isFirst && {
          borderTopLeftRadius: radius.full,
          borderBottomLeftRadius: radius.full,
        },
        isLast && {
          borderTopRightRadius: radius.full,
          borderBottomRightRadius: radius.full,
        },
        active && styles.tabActive,
        pressed && !active && { opacity: 0.85 },
      ]}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: fontWeight.semibold,
          color: active ? color.textPrimary : color.textSecondary,
        }}
      >
        {label}
      </Text>
      <View
        style={[styles.count, active && styles.countActive]}
        importantForAccessibility="no"
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: fontWeight.bold,
            justifyContent: 'center',
            alignItems: 'center',
            display: 'flex',
            color: active ? palette.terracotta600 : color.textSecondary,
            fontVariant: ['tabular-nums'],
          }}
        >
          {count}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pad: {
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
  },
  segment: {
    flexDirection: 'row',
    padding: 4,
    gap: 2,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: space.md,
    borderRadius: radius.full,
    backgroundColor: 'transparent',
  },
  tabActive: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    shadowColor: 'rgba(28,20,16,0.18)',
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  count: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: 'rgba(28,20,16,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countActive: {
    backgroundColor: palette.terracotta50,
  },
});
