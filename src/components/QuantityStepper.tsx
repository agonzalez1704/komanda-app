import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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
  return (
    <View style={styles.row}>
      <TouchableOpacity
        disabled={value <= min}
        onPress={() => onChange(value - 1)}
        style={[styles.btn, value <= min && styles.btnDisabled]}
      >
        <Text style={styles.btnText}>−</Text>
      </TouchableOpacity>
      <Text style={styles.value}>{value}</Text>
      <TouchableOpacity
        disabled={value >= max}
        onPress={() => onChange(value + 1)}
        style={[styles.btn, value >= max && styles.btnDisabled]}
      >
        <Text style={styles.btnText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  btn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center' },
  btnDisabled: { opacity: 0.3 },
  btnText: { color: 'white', fontSize: 22, fontWeight: '700' },
  value: { fontSize: 20, fontWeight: '700', minWidth: 32, textAlign: 'center' },
});
