import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassSurface, Text } from '@/components/ui';
import type { KomandaStatusT } from '@/insforge/schemas';
import {
  blockReasonMessage,
  canTransitionStatus,
  effectiveStatus,
  transitionBlockedReason,
  type ManualStatus,
} from '@/domain/komandaStatus';
import { color, fontWeight, radius, space } from '@/theme/tokens';

const STATUSES: {
  key: ManualStatus;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
}[] = [
  { key: 'pending', label: 'Pendiente', icon: 'time-outline' },
  { key: 'served', label: 'Servida', icon: 'checkmark-circle-outline' },
  { key: 'closed', label: 'Cobrada', icon: 'card-outline' },
];

export function StatusSegment({
  current,
  itemCount,
  onChange,
}: {
  current: KomandaStatusT;
  itemCount: number;
  onChange: (next: ManualStatus) => void;
}) {
  // Collapse legacy 'open' onto 'pending' for highlight purposes.
  const effective = effectiveStatus(current);

  function attempt(next: ManualStatus) {
    const blocked = transitionBlockedReason(current, next, { itemCount });
    if (blocked) {
      Alert.alert('No se puede', blockReasonMessage(blocked), [
        { text: 'Entendido' },
      ]);
      return;
    }
    onChange(next);
  }

  return (
    <View style={styles.section}>
      <Text variant="label">Estado</Text>
      <GlassSurface radius={radius.full} contentStyle={styles.segment}>
        {STATUSES.map((s) => {
          const active = effective === s.key;
          // A chip is interactive only when the lifecycle allows the move.
          // The current status is always shown but greyed/locked.
          const canMove = canTransitionStatus(current, s.key);
          const disabled = !active && !canMove;
          return (
            <Pressable
              key={s.key}
              onPress={() => {
                if (!disabled && !active) attempt(s.key);
              }}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={`Cambiar a ${s.label}`}
              accessibilityState={{ selected: active, disabled }}
              style={({ pressed }) => [
                styles.chip,
                active && styles.chipActive,
                disabled && styles.chipDisabled,
                pressed && !active && !disabled && { opacity: 0.85 },
              ]}
            >
              <Ionicons
                name={s.icon}
                size={16}
                color={
                  active
                    ? color.primaryOn
                    : disabled
                      ? color.textTertiary
                      : color.textSecondary
                }
              />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: fontWeight.semibold,
                  color: active
                    ? color.primaryOn
                    : disabled
                      ? color.textTertiary
                      : color.textPrimary,
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
  chipDisabled: {
    opacity: 0.45,
  },
});
