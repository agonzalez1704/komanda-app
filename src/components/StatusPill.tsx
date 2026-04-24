import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { color as tokenColor, fontWeight, palette, radius, space } from '@/theme/tokens';
import type { KomandaStatusT } from '@/insforge/schemas';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const STATUS_STYLE: Record<
  KomandaStatusT,
  { bg: string; fg: string; dot: string; icon: IconName; label: string }
> = {
  open:    { bg: palette.info50,    fg: palette.info700,    dot: palette.info500,    icon: 'ellipse',               label: 'Open' },
  pending: { bg: palette.warning50, fg: palette.warning700, dot: palette.warning500, icon: 'time-outline',          label: 'Pending' },
  served:  { bg: palette.success50, fg: palette.success700, dot: palette.success500, icon: 'checkmark-circle',      label: 'Served' },
  closed:  { bg: tokenColor.surfaceAlt, fg: tokenColor.textSecondary, dot: tokenColor.textTertiary, icon: 'lock-closed', label: 'Closed' },
};

export function StatusPill({ status, size = 'md' }: { status: KomandaStatusT; size?: 'sm' | 'md' }) {
  const s = STATUS_STYLE[status];
  const small = size === 'sm';
  return (
    <View style={[styles.pill, { backgroundColor: s.bg }, small && styles.small]}>
      <Ionicons name={s.icon} size={small ? 10 : 12} color={s.fg} />
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
  },
  small: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
});
