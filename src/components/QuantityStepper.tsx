import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Text } from '@/components/ui/Text';
import { color, fontWeight, radius, space } from '@/theme/tokens';

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  const minDisabled = value <= min;
  const maxDisabled = value >= max;

  function bump(next: number, disabled: boolean) {
    if (disabled) return;
    Haptics.selectionAsync().catch(() => {});
    onChange(next);
  }

  return (
    <View style={styles.row}>
      <StepperButton
        icon="remove"
        disabled={minDisabled}
        onPress={() => bump(value - 1, minDisabled)}
        accessibilityLabel="Decrease quantity"
      />
      <View style={styles.valueWrap}>
        <Text
          style={{
            fontSize: 28,
            fontWeight: fontWeight.bold,
            color: color.textPrimary,
            fontVariant: ['tabular-nums'],
          }}
        >
          {value}
        </Text>
      </View>
      <StepperButton
        icon="add"
        disabled={maxDisabled}
        onPress={() => bump(value + 1, maxDisabled)}
        accessibilityLabel="Increase quantity"
      />
    </View>
  );
}

function StepperButton({
  icon,
  disabled,
  onPress,
  accessibilityLabel,
}: {
  icon: 'add' | 'remove';
  disabled: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.btn,
        pressed && !disabled && { opacity: 0.8, transform: [{ scale: 0.96 }] },
        disabled && { opacity: 0.35 },
      ]}
    >
      <Ionicons name={icon} size={24} color={color.primaryOn} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xl,
    alignSelf: 'flex-start',
  },
  btn: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    backgroundColor: color.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueWrap: {
    minWidth: 44,
    alignItems: 'center',
  },
});
