import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TextField } from '@/components/ui';
import { color, hitSlop, space } from '@/theme/tokens';

export function SearchField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.pad}>
      <TextField
        placeholder="Search by number or table label"
        value={value}
        onChangeText={onChange}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        autoFocus
        leading={
          <Ionicons name="search" size={18} color={color.textTertiary} />
        }
        trailing={
          value ? (
            <Pressable
              onPress={() => onChange('')}
              hitSlop={hitSlop}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Ionicons
                name="close-circle"
                size={18}
                color={color.textTertiary}
              />
            </Pressable>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pad: {
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
  },
});
