import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui';
import { color, space } from '@/theme/tokens';
import type { InvitationRowT } from '@/insforge/schemas';

type Props = {
  invitation: InvitationRowT;
  onRevoke: () => void;
  onCopy: () => void;
};

function daysUntil(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  const d = Math.ceil(ms / (24 * 60 * 60 * 1000));
  if (d <= 0) return 'expired';
  if (d === 1) return 'expires in 1 day';
  return `expires in ${d} days`;
}

export function InviteRow({ invitation, onRevoke, onCopy }: Props) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {invitation.email}
        </Text>
        <Text variant="caption">
          <Text variant="caption" style={{ textTransform: 'capitalize' }}>
            {invitation.role}
          </Text>
          {' · '}
          {daysUntil(invitation.expires_at)}
        </Text>
      </View>
      <Pressable
        onPress={onCopy}
        accessibilityRole="button"
        accessibilityLabel="Copy invite code"
        hitSlop={8}
        style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
      >
        <Ionicons name="copy-outline" size={20} color={color.textSecondary} />
      </Pressable>
      <Pressable
        onPress={onRevoke}
        accessibilityRole="button"
        accessibilityLabel="Revoke invitation"
        hitSlop={8}
        style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}
      >
        <Ionicons name="trash-outline" size={20} color={color.danger} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
