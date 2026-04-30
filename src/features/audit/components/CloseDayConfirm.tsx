import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Divider, Text } from '@/components/ui';
import { color, fontWeight, space } from '@/theme/tokens';
import { formatMXN } from '@/domain/money';
import type { AuditAggregate } from '@/domain/audit';

type Props = {
  data: AuditAggregate;
  openKomandasCount: number;
  onCancel: () => void;
  onConfirm: () => void;
  pending: boolean;
};

export function CloseDayConfirm({
  data,
  openKomandasCount,
  onCancel,
  onConfirm,
  pending,
}: Props) {
  const blocked = openKomandasCount > 0;

  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        {blocked ? (
          <>
            <View style={styles.iconWrap}>
              <Ionicons
                name="alert-circle-outline"
                size={32}
                color={color.warning}
              />
            </View>
            <Text variant="h2" align="center">
              Cannot close yet
            </Text>
            <Text variant="bodySm" align="center">
              {openKomandasCount} open komanda
              {openKomandasCount === 1 ? '' : 's'}. Close them first.
            </Text>
            <Pressable onPress={onCancel} style={styles.dismiss}>
              <Text variant="bodySm" align="center">
                Cancel
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text variant="h2">Close day?</Text>
            <Text variant="bodySm">
              Review today’s totals before closing.
            </Text>

            <View style={styles.rows}>
              <Row label="Earnings" value={formatMXN(data.earnings.total)} />
              <Divider />
              <Row label="Expenses" value={formatMXN(data.expenses.total)} />
              <Divider />
              <Row
                label="Net"
                value={formatMXN(data.net)}
                bold
                negative={data.net < 0}
              />
              <Divider />
              <Row
                label="Cash drawer expected"
                value={formatMXN(data.cashDrawerExpected)}
              />
            </View>

            <Button
              label="Close day"
              onPress={onConfirm}
              loading={pending}
              disabled={pending}
              leadingIcon={
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color={color.primaryOn}
                />
              }
            />
            <Pressable onPress={onCancel} style={styles.dismiss}>
              <Text variant="bodySm" align="center">
                Cancel
              </Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

function Row({
  label,
  value,
  bold,
  negative,
}: {
  label: string;
  value: string;
  bold?: boolean;
  negative?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text
        variant={bold ? 'bodyStrong' : 'body'}
        style={{ flex: 1 }}
      >
        {label}
      </Text>
      <Text
        mono
        style={{
          fontWeight: bold ? fontWeight.bold : fontWeight.regular,
          color: negative ? color.danger : color.textPrimary,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0006',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: color.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.xxl,
    gap: space.sm,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: color.border,
    alignSelf: 'center',
    marginVertical: space.sm,
  },
  iconWrap: {
    alignItems: 'center',
    paddingVertical: space.sm,
  },
  rows: {
    marginVertical: space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.md,
    gap: space.md,
  },
  dismiss: {
    paddingVertical: space.md,
  },
});
