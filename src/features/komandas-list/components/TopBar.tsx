import { StyleSheet, View } from 'react-native';
import {
  GlassSurface,
  IconButton,
  Text,
} from '@/components/ui';
import { color, fontWeight, radius, space } from '@/theme/tokens';

export function TopBar({
  dateLabel,
  searchOpen,
  onToggleSearch,
  onOpenSettings,
}: {
  dateLabel: string;
  searchOpen: boolean;
  onToggleSearch: () => void;
  onOpenSettings: () => void;
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
        <View style={styles.center}>
          <Text numberOfLines={1} style={styles.title}>
            Komandas
          </Text>
          <Text numberOfLines={1} style={styles.date}>
            {dateLabel}
          </Text>
        </View>
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
  date: {
    fontSize: 11,
    lineHeight: 14,
    color: color.textSecondary,
    marginTop: 1,
    textAlign: 'center',
  },
});
