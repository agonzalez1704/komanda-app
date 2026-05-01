import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { useQueueSnapshot } from '@/offline/useQueueSnapshot';
import { dequeueWithDependents, resetAttempts } from '@/offline/queue';
import { queueStore } from '@/offline/handlers';
import { kickDrain } from '@/offline/drain';
import { formatError } from '@/offline/processor';
import { color, fontWeight, radius, space } from '@/theme/tokens';

const RETRY_BUDGET = 5;

/**
 * We show the banner the moment any queued mutation carries an error,
 * not only when it's burned through all 5 attempts. Waiting 25 seconds
 * before revealing a sync failure meant the UI silently lied to the user
 * in between — they'd see optimistic "closed" komandas that the server had
 * never acknowledged. Better to say "something failed, here's what" on
 * attempt #1.
 */
function isStuck(m: { lastError: string | null; attemptCount: number }) {
  return m.lastError !== null || m.attemptCount >= RETRY_BUDGET;
}

const HUMAN_LABELS: Record<string, string> = {
  create_komanda: 'New komanda',
  rename_komanda: 'Rename komanda',
  update_status: 'Update status',
  add_item: 'Add item',
  update_item: 'Update item',
  remove_item: 'Remove item',
  close_komanda: 'Close & charge',
  upsert_product: 'Save product',
  delete_product: 'Delete product',
  upsert_variant: 'Save variant',
  delete_variant: 'Delete variant',
  upsert_modifier: 'Save modifier',
  delete_modifier: 'Delete modifier',
};

export function StuckMutationsBanner() {
  const all = useQueueSnapshot();
  const stuck = all.filter(isStuck);
  if (stuck.length === 0) return null;
  const exhausted = stuck.filter((m) => m.attemptCount >= RETRY_BUDGET).length;

  function onPress() {
    const body = stuck
      .map((m) => {
        const label = HUMAN_LABELS[m.type] ?? m.type;
        // Defensive: lastError *should* be a string now, but entries queued
        // before the fix may still hold a non-string. Always coerce.
        const err = formatError(m.lastError);
        return `• ${label}: ${err}`;
      })
      .join('\n');

    Alert.alert(
      `${stuck.length} pending sync issue${stuck.length === 1 ? '' : 's'}`,
      exhausted > 0
        ? `${body}\n\n${exhausted} ${exhausted === 1 ? 'has' : 'have'} given up retrying — tap Retry now or Discard.`
        : `${body}\n\nStill retrying automatically. Tap Retry now to kick it, or Discard to drop.`,
      [
        { text: 'Leave for now', style: 'cancel' },
        {
          text: 'Retry now',
          onPress: async () => {
            await resetAttempts(queueStore, stuck.map((m) => m.id));
            kickDrain();
          },
        },
        {
          text: 'Discard all',
          style: 'destructive',
          onPress: async () => {
            // Cascade: dropping a stuck create_komanda also drops its
            // queued add_items / updates / close that would otherwise FK-fail
            // forever now that their parent is gone.
            await dequeueWithDependents(queueStore, stuck.map((m) => m.id));
          },
        },
      ],
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.banner, pressed && { opacity: 0.85 }]}
      accessibilityRole="button"
      accessibilityLabel={`${stuck.length} changes ${exhausted > 0 ? 'failed to sync' : 'hit a sync error'}. Tap for details.`}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="alert-circle" size={16} color={color.dangerText} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: color.dangerText,
            fontSize: 13,
            fontWeight: fontWeight.semibold,
          }}
        >
          {stuck.length} change{stuck.length === 1 ? '' : 's'}{' '}
          {exhausted > 0 ? 'failed to sync' : 'hit a sync error'}
        </Text>
        <Text style={{ color: color.dangerText, fontSize: 12, opacity: 0.85 }}>
          Tap for details
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={color.dangerText} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: space.lg,
    marginBottom: space.sm,
    backgroundColor: color.dangerBg,
    borderWidth: 1,
    borderColor: color.danger,
    borderRadius: radius.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(180, 42, 42, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
