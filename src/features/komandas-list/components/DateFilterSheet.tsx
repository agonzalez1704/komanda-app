import { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Text } from '@/components/ui';
import { color, fontWeight, radius, space } from '@/theme/tokens';

/**
 * Date picker sheet for the komandas list. "Current shift" is the default
 * scope (null) — keeps a past-midnight shift visible. Picking a specific
 * date filters to that calendar day.
 *
 * iOS uses the inline spinner; Android pops the platform dialog directly
 * and the surrounding modal just holds the quick-action buttons.
 */
export function DateFilterSheet({
  visible,
  initial,
  onClose,
  onSelect,
}: {
  visible: boolean;
  initial: Date | null;
  onClose: () => void;
  onSelect: (date: Date | null) => void;
}) {
  const [tempDate, setTempDate] = useState<Date>(initial ?? new Date());

  function pickToday() {
    onSelect(null);
    onClose();
  }
  function pickYesterday() {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    onSelect(y);
    onClose();
  }
  function confirm() {
    onSelect(tempDate);
    onClose();
  }

  function handlePickerChange(event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS === 'android') {
      // Android dismisses on its own; treat any non-set event as cancel.
      if (event.type === 'set' && date) {
        onSelect(date);
      }
      onClose();
      return;
    }
    if (date) setTempDate(date);
  }

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Filtrar por fecha</Text>

          <View style={styles.quickRow}>
            <QuickButton label="Turno actual" onPress={pickToday} />
            <QuickButton label="Ayer" onPress={pickYesterday} />
          </View>

          {Platform.OS === 'ios' ? (
            <View style={styles.pickerWrap}>
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="inline"
                maximumDate={new Date()}
                onChange={handlePickerChange}
                themeVariant="light"
              />
            </View>
          ) : (
            <DateTimePicker
              value={tempDate}
              mode="date"
              display="default"
              maximumDate={new Date()}
              onChange={handlePickerChange}
            />
          )}

          {Platform.OS === 'ios' ? (
            <View style={styles.actions}>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [
                  styles.ghost,
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Text style={styles.ghostLabel}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={confirm}
                style={({ pressed }) => [
                  styles.primary,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.primaryLabel}>Aplicar</Text>
              </Pressable>
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function QuickButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.quick,
        pressed && { opacity: 0.8 },
      ]}
    >
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: color.bgElevated,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: space.lg,
    paddingBottom: space.xl + space.md,
    gap: space.md,
  },
  title: {
    fontSize: 16,
    fontWeight: fontWeight.bold,
    color: color.textPrimary,
    textAlign: 'center',
  },
  quickRow: {
    flexDirection: 'row',
    gap: space.sm,
  },
  quick: {
    flex: 1,
    paddingVertical: space.md,
    borderRadius: radius.full,
    backgroundColor: color.surface,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  quickLabel: {
    fontSize: 14,
    fontWeight: fontWeight.semibold,
    color: color.textPrimary,
  },
  pickerWrap: {
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.sm,
  },
  ghost: {
    flex: 1,
    paddingVertical: space.md,
    alignItems: 'center',
    borderRadius: radius.full,
  },
  ghostLabel: {
    fontSize: 15,
    fontWeight: fontWeight.semibold,
    color: color.textSecondary,
  },
  primary: {
    flex: 1,
    paddingVertical: space.md,
    alignItems: 'center',
    borderRadius: radius.full,
    backgroundColor: color.primary,
  },
  primaryLabel: {
    fontSize: 15,
    fontWeight: fontWeight.bold,
    color: color.primaryOn,
  },
});
