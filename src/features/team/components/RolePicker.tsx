import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui';
import { color, radius, space } from '@/theme/tokens';
import type { RoleT } from '@/insforge/schemas';

const ROLES: RoleT[] = ['admin', 'cashier', 'waiter', 'cook'];

type Props = {
  current: RoleT;
  onClose: () => void;
  onPick: (r: RoleT) => void;
};

export function RolePicker({ current, onClose, onPick }: Props) {
  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text variant="h2">Change role</Text>

        <View style={{ marginTop: space.sm }}>
          {ROLES.map((r) => {
            const selected = r === current;
            return (
              <Pressable
                key={r}
                onPress={() => onPick(r)}
                style={({ pressed }) => [
                  styles.row,
                  pressed && { opacity: 0.7 },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Set role to ${r}`}
              >
                <Text
                  variant="bodyStrong"
                  style={{ flex: 1, textTransform: 'capitalize' }}
                >
                  {r}
                </Text>
                {selected ? (
                  <Ionicons name="checkmark" size={20} color={color.primary} />
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <Pressable onPress={onClose} style={styles.dismiss}>
          <Text variant="bodySm" align="center">
            Cancel
          </Text>
        </Pressable>
      </View>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
    borderRadius: radius.sm,
  },
  dismiss: {
    paddingVertical: space.md,
  },
});
