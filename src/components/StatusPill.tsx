import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { fontWeight, palette, radius, space } from '@/theme/tokens';
import type { KomandaStatusT } from '@/insforge/schemas';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * Vivid status badges — solid bright bg + white text. Designed to POP
 * against the warm linen canvas so a waiter scanning the list spots
 * state at a glance.
 *
 * Mapping:
 *   pending → Alert Red       (urgency, "this table is waiting on me")
 *   served  → Vivid Green     (delivered, success)
 *   closed  → Electric Magenta (paid, completion accent)
 */
const STATUS_STYLE: Record<
  KomandaStatusT,
  { bg: string; fg: string; shadow: string; icon: IconName; label: string }
> = {
  // 'open' is a deprecated bucket — render as Pendiente so the lifecycle
  // surfaces consistently across legacy + new rows.
  open: {
    bg: palette.vividRed500,
    fg: palette.white,
    shadow: palette.vividRed700,
    icon: 'time-outline',
    label: 'Pendiente',
  },
  pending: {
    bg: palette.vividRed500,
    fg: palette.white,
    shadow: palette.vividRed700,
    icon: 'time-outline',
    label: 'Pendiente',
  },
  served: {
    bg: palette.vividGreen500,
    fg: palette.white,
    shadow: palette.vividGreen700,
    icon: 'checkmark-circle',
    label: 'Servida',
  },
  closed: {
    bg: palette.vividMagenta500,
    fg: palette.white,
    shadow: palette.vividMagenta700,
    icon: 'lock-closed',
    label: 'Cobrada',
  },
};

export function StatusPill({
  status,
  size = 'md',
}: {
  status: KomandaStatusT;
  size?: 'sm' | 'md';
}) {
  const s = STATUS_STYLE[status];
  const small = size === 'sm';
  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: s.bg,
          shadowColor: s.shadow,
        },
        small && styles.small,
      ]}
    >
      <Ionicons
        name={s.icon}
        size={small ? 10 : 12}
        color={s.fg}
      />
      <Text
        style={{
          color: s.fg,
          fontSize: small ? 10 : 11,
          fontWeight: fontWeight.bold,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
        }}
      >
        {s.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
    // Soft colored ground shadow — pulls the badge off the surface and
    // amplifies the vivid fill so it reads as "lit", not painted.
    shadowOpacity: 0.32,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  small: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    shadowOpacity: 0.22,
    shadowRadius: 4,
  },
});
