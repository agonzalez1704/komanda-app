import { StyleSheet, View } from 'react-native';
import { GlassSurface, IconButton, Text } from '@/components/ui';
import { StatusPill } from '@/components/StatusPill';
import { displayIdentifier } from '@/domain/komandaNumber';
import type { KomandaRowT } from '@/insforge/schemas';
import { color, fontWeight, radius, space } from '@/theme/tokens';

export function DetailNavBar({
  row,
  onBack,
}: {
  row: KomandaRowT;
  onBack: () => void;
}) {
  return (
    <View style={styles.pad}>
      <GlassSurface radius={radius.xxl} contentStyle={styles.inner}>
        <IconButton
          glass
          name="chevron-back"
          accessibilityLabel="Back"
          onPress={onBack}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>Komanda</Text>
          <Text mono numberOfLines={1} style={styles.ident}>
            {displayIdentifier(row)}
          </Text>
        </View>
        <StatusPill status={row.status} />
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
    gap: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    minHeight: 60,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: color.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  ident: {
    fontSize: 17,
    fontWeight: fontWeight.bold,
    color: color.textPrimary,
    letterSpacing: -0.2,
  },
});
