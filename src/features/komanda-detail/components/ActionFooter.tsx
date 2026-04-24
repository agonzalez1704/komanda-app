import { StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, GlassSurface } from '@/components/ui';
import { formatMXN } from '@/domain/money';
import { color, radius, space } from '@/theme/tokens';

/**
 * Paired action bar at the bottom of the detail screen. We deliberately
 * avoid `<Link asChild>` here: our Button wraps its onPress with a haptic
 * handler, and expo-router's asChild cloneElement path did not reliably
 * hit that wrapper when two Link+Button pairs sat side-by-side. Taps on
 * "Close" would fire the sibling's navigation and dump the user on the
 * add-item (menu) screen. Plain router.push from the Button's own onPress
 * is the canonical, bug-free pattern for custom press components.
 */
export function ActionFooter({
  closed,
  lineCount,
  totalCents,
  onAdd,
  onClose,
  onReshare,
}: {
  closed: boolean;
  lineCount: number;
  totalCents: number;
  onAdd: () => void;
  onClose: () => void;
  onReshare: () => void;
}) {
  if (closed) {
    return (
      <GlassSurface radius={radius.xxl} contentStyle={styles.closed}>
        <Button
          label="Share receipt again"
          onPress={onReshare}
          leadingIcon={
            <Ionicons name="share-outline" size={18} color={color.primaryOn} />
          }
        />
      </GlassSurface>
    );
  }

  return (
    <GlassSurface radius={radius.xxl} contentStyle={styles.open}>
      <Button
        label={lineCount === 0 ? 'Add first item' : 'Add item'}
        variant="secondary"
        style={{ flex: 1 }}
        leadingIcon={<Ionicons name="add" size={20} color={color.textPrimary} />}
        onPress={onAdd}
      />
      <Button
        label={lineCount === 0 ? 'Close' : `Close · ${formatMXN(totalCents)}`}
        disabled={lineCount === 0}
        style={{ flex: 1.3 }}
        leadingIcon={
          <Ionicons name="card-outline" size={18} color={color.primaryOn} />
        }
        onPress={onClose}
      />
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  open: {
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
  },
  closed: {
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
  },
});
