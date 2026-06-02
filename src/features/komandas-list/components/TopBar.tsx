import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  GlassSurface,
  IconButton,
  Text,
} from '@/components/ui';
import { color, fontWeight, radius, space } from '@/theme/tokens';

export function TopBar({
  dateLabel,
  dateFiltered,
  onPressDate,
  searchOpen,
  onToggleSearch,
  onOpenSettings,
  onOpenAudit,
}: {
  dateLabel: string;
  /** True when a non-default date is selected; surfaces a small dot + caret. */
  dateFiltered?: boolean;
  onPressDate?: () => void;
  searchOpen: boolean;
  onToggleSearch: () => void;
  onOpenSettings: () => void;
  onOpenAudit?: () => void;
}) {
  return (
    <View style={styles.pad}>
      <GlassSurface radius={radius.xxl} contentStyle={styles.inner}>
        <IconButton
          glass
          name={searchOpen ? 'close' : 'search-outline'}
          accessibilityLabel={searchOpen ? 'Close search' : 'Search komandas'}
          onPress={onToggleSearch}
        />
        <Pressable
          onPress={onPressDate}
          disabled={!onPressDate}
          accessibilityRole={onPressDate ? 'button' : undefined}
          accessibilityLabel={`Filtrar por fecha: ${dateLabel}`}
          style={({ pressed }) => [
            styles.center,
            pressed && onPressDate && { opacity: 0.7 },
          ]}
        >
          <Text numberOfLines={1} style={styles.title}>
            Komandas
          </Text>
          <View style={styles.dateRow}>
            {dateFiltered ? <View style={styles.dot} /> : null}
            <Text numberOfLines={1} style={styles.date}>
              {dateLabel}
            </Text>
            {onPressDate ? (
              <Ionicons
                name="chevron-down"
                size={12}
                color={color.textSecondary}
                style={{ marginLeft: 2 }}
              />
            ) : null}
          </View>
        </Pressable>
        {onOpenAudit ? (
          <IconButton
            glass
            name="stats-chart-outline"
            accessibilityLabel="Audit"
            onPress={onOpenAudit}
          />
        ) : null}
        <IconButton
          glass
          name="settings-outline"
          accessibilityLabel="Settings"
          onPress={onOpenSettings}
        />
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: {
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
    paddingBottom: space.sm,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: 56,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 0,
  },
  title: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: fontWeight.semibold,
    color: color.textPrimary,
    letterSpacing: -0.1,
    textAlign: 'center',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
  },
  date: {
    fontSize: 11,
    lineHeight: 14,
    color: color.textSecondary,
    textAlign: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: color.primary,
    marginRight: 6,
  },
});
