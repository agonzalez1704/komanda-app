import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui';
import { color, fontWeight, radius, space } from '@/theme/tokens';
import type { OrganizationMemberRowT } from '@/insforge/schemas';

type Props = {
  member: OrganizationMemberRowT;
  showOverflow: boolean;
  onOverflow: () => void;
};

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

export function MemberRow({ member, showOverflow, onOverflow }: Props) {
  const initials = initialsOf(member.display_name) || '?';
  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <Text
          style={{
            color: color.textPrimary,
            fontWeight: fontWeight.semibold,
            fontSize: 14,
          }}
        >
          {initials}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {member.display_name}
        </Text>
        <Text variant="caption" style={{ textTransform: 'capitalize' }}>
          {member.role}
        </Text>
      </View>
      {showOverflow ? (
        <Pressable
          onPress={onOverflow}
          accessibilityRole="button"
          accessibilityLabel="Member options"
          hitSlop={8}
          style={({ pressed }) => [
            styles.overflowBtn,
            pressed && { opacity: 0.6 },
          ]}
        >
          <Ionicons
            name="ellipsis-horizontal"
            size={20}
            color={color.textSecondary}
          />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: color.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overflowBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
