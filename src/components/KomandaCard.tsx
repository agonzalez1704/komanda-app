import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/Text';
import { StatusPill } from './StatusPill';
import { displayIdentifier } from '@/domain/komandaNumber';
import { formatMXN } from '@/domain/money';
import { color, fontWeight, radius, shadow, space } from '@/theme/tokens';
import type { KomandaRowT } from '@/insforge/schemas';

export function KomandaCard({
  k,
  itemCount,
  runningTotalCents,
  onPress,
  syncedServerSide,
}: {
  k: KomandaRowT;
  itemCount: number;
  runningTotalCents: number;
  onPress: () => void;
  syncedServerSide: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: 'rgba(28,20,16,0.06)' }}
      style={({ pressed }) => [
        styles.card,
        pressed && { opacity: 0.92, transform: [{ scale: 0.995 }] },
      ]}
    >
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          {/* Identifier is secondary — the eye should land on the total in
              the bottom-right. 15pt / 600 reads as a confident label without
              competing with the money. */}
          <Text
            style={{
              fontSize: 15,
              fontWeight: fontWeight.semibold,
              color: color.textSecondary,
              fontVariant: ['tabular-nums'],
              letterSpacing: 0.2,
            }}
          >
            {displayIdentifier(k)}
          </Text>
          {k.display_name ? (
            <Text
              numberOfLines={1}
              style={{
                marginTop: 2,
                fontSize: 16,
                fontWeight: fontWeight.semibold,
                color: color.textPrimary,
              }}
            >
              {k.display_name}
            </Text>
          ) : null}
        </View>
        <StatusPill status={k.status} />
      </View>

      <View style={styles.bottomRow}>
        <View style={styles.meta}>
          <Ionicons name="fast-food-outline" size={14} color={color.textTertiary} />
          <Text variant="footnote">
            {itemCount} item{itemCount === 1 ? '' : 's'}
          </Text>
          {!syncedServerSide ? (
            <View style={styles.pendingBadge}>
              <Ionicons name="cloud-upload-outline" size={12} color={color.warningText} />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: fontWeight.semibold,
                  color: color.warningText,
                }}
              >
                Syncing
              </Text>
            </View>
          ) : null}
        </View>
        {/* Total wins the visual hierarchy — 20pt / 700, tabular so the
            column of money lines up down the list. */}
        <Text
          mono
          style={{
            fontSize: 20,
            fontWeight: fontWeight.bold,
            color: color.textPrimary,
            letterSpacing: -0.2,
            fontVariant: ['tabular-nums'],
          }}
        >
          {formatMXN(runningTotalCents)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: space.lg,
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    gap: space.md,
    marginBottom: space.sm,
    ...shadow.sm,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: space.md,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    flex: 1,
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: color.warningBg,
  },
});
