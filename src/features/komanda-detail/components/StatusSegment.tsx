import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassSurface, Text } from '@/components/ui';
import type { KomandaStatusT } from '@/insforge/schemas';
import { color, fontWeight, radius, space } from '@/theme/tokens';

type VisibleStatus = Exclude<KomandaStatusT, 'closed'>;

const STATUSES: {
  key: VisibleStatus;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}[] = [
  { key: 'open', label: 'Open', icon: 'ellipse-outline' },
  { key: 'pending', label: 'Pending', icon: 'time-outline' },
  { key: 'served', label: 'Served', icon: 'checkmark-circle-outline' },
];

export function StatusSegment({
  current,
  onChange,
}: {
  current: KomandaStatusT;
  onChange: (next: VisibleStatus) => void;
}) {
  return (
    <View style={styles.section}>
      <Text variant="label">Status</Text>
      <GlassSurface radius={radius.full} contentStyle={styles.segment}>
        {STATUSES.map((s) => {
          const active = current === s.key;
          return (
            <Pressable
              key={s.key}
              onPress={() => onChange(s.key)}
              accessibilityRole="button"
              accessibilityLabel={`Set status to ${s.label}`}
              accessibilityState={{ selected: active }}
              style={({ pressed }) => [
                styles.chip,
                active && styles.chipActive,
                pressed && !active && { opacity: 0.85 },
              ]}
            >
              <Ionicons
                name={s.icon}
                size={16}
                color={active ? color.primaryOn : color.textSecondary}
              />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: fontWeight.semibold,
                  color: active ? color.primaryOn : color.textPrimary,
                }}
              >
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    gap: space.sm,
  },
  segment: {
    flexDirection: 'row',
    padding: 4,
    gap: 2,
  },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    minHeight: 40,
    paddingHorizontal: space.sm,
    borderRadius: radius.full,
    backgroundColor: 'transparent',
  },
  chipActive: {
    backgroundColor: color.primary,
  },
});
