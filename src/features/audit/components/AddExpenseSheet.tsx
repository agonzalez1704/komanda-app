import { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Button, Text } from '@/components/ui';
import { color, radius, space } from '@/theme/tokens';
import { listExpenseCategories } from '@/insforge/queries/expenseCategories';
import { useCreateExpense } from '@/mutations/useCreateExpense';
import type { ExpensePaidByT } from '@/insforge/schemas';

const PAID_BY: ExpensePaidByT[] = ['cash', 'card', 'transfer', 'personal'];

type Props = {
  orgId: string;
  periodId: string;
  onClose: () => void;
};

export function AddExpenseSheet({ orgId, periodId, onClose }: Props) {
  const categories = useQuery({
    queryKey: ['expense-categories', orgId, 'active'],
    queryFn: () => listExpenseCategories(orgId, { activeOnly: true }),
  });

  const [amountText, setAmountText] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [otherActive, setOtherActive] = useState(false);
  const [otherLabel, setOtherLabel] = useState('');
  const [paidBy, setPaidBy] = useState<ExpensePaidByT>('cash');
  const [note, setNote] = useState('');

  const createExpense = useCreateExpense(orgId, periodId);

  const amountCents = useMemo(() => {
    const cleaned = amountText.replace(',', '.').trim();
    if (!cleaned) return 0;
    const v = parseFloat(cleaned);
    if (!Number.isFinite(v)) return 0;
    return Math.round(v * 100);
  }, [amountText]);

  function pickCategory(id: string) {
    setCategoryId(id);
    setOtherActive(false);
  }

  function pickOther() {
    setCategoryId(null);
    setOtherActive(true);
  }

  function handleSave() {
    if (amountCents <= 0) {
      Alert.alert('Invalid amount', 'Enter an amount greater than zero.');
      return;
    }
    if (!note.trim()) {
      Alert.alert('Note required', 'Please add a short note describing the expense.');
      return;
    }
    if (!categoryId && !otherActive) {
      Alert.alert('Category required', 'Pick a category or choose Other.');
      return;
    }
    if (otherActive && !otherLabel.trim()) {
      Alert.alert(
        'Label required',
        'Type a short label for the "Other" category.',
      );
      return;
    }

    createExpense.mutate(
      {
        amount_cents: amountCents,
        category_id: categoryId,
        category_other_label: otherActive ? otherLabel.trim() : null,
        note: note.trim(),
        paid_by: paidBy,
      },
      {
        onSuccess: () => onClose(),
        onError: (e) =>
          Alert.alert('Could not save', String((e as Error).message)),
      },
    );
  }

  const cats = categories.data ?? [];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.backdrop}
      pointerEvents="box-none"
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <ScrollView
          contentContainerStyle={{ gap: space.md, paddingBottom: space.lg }}
          keyboardShouldPersistTaps="handled"
        >
          <Text variant="h2">Add expense</Text>

          <View style={{ gap: space.xs }}>
            <Text variant="label">Amount</Text>
            <TextInput
              value={amountText}
              onChangeText={setAmountText}
              placeholder="0.00"
              placeholderTextColor={color.textTertiary}
              keyboardType="decimal-pad"
              style={styles.input}
            />
          </View>

          <View style={{ gap: space.xs }}>
            <Text variant="label">Category</Text>
            <View style={styles.chips}>
              {cats.map((c) => {
                const active = c.id === categoryId;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => pickCategory(c.id)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text
                      variant="bodySm"
                      style={{
                        color: active ? color.primaryOn : color.textPrimary,
                      }}
                    >
                      {c.name}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={pickOther}
                style={[styles.chip, otherActive && styles.chipActive]}
              >
                <Text
                  variant="bodySm"
                  style={{
                    color: otherActive ? color.primaryOn : color.textPrimary,
                  }}
                >
                  Other
                </Text>
              </Pressable>
            </View>
            {otherActive ? (
              <TextInput
                value={otherLabel}
                onChangeText={setOtherLabel}
                placeholder="Custom category label"
                placeholderTextColor={color.textTertiary}
                style={styles.input}
              />
            ) : null}
          </View>

          <View style={{ gap: space.xs }}>
            <Text variant="label">Paid by</Text>
            <View style={styles.segment}>
              {PAID_BY.map((p) => {
                const active = p === paidBy;
                return (
                  <Pressable
                    key={p}
                    onPress={() => setPaidBy(p)}
                    style={[
                      styles.segmentItem,
                      active && styles.segmentActive,
                    ]}
                  >
                    <Text
                      variant="bodySm"
                      style={{
                        color: active ? color.primaryOn : color.textPrimary,
                        textTransform: 'capitalize',
                      }}
                    >
                      {p}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ gap: space.xs }}>
            <Text variant="label">Note</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="What was this for?"
              placeholderTextColor={color.textTertiary}
              multiline
              numberOfLines={3}
              style={[styles.input, styles.textarea]}
            />
          </View>

          <Button
            label="Save expense"
            onPress={handleSave}
            loading={createExpense.isPending}
            disabled={createExpense.isPending}
            leadingIcon={
              <Ionicons name="save-outline" size={18} color={color.primaryOn} />
            }
          />
          <Pressable onPress={onClose} style={styles.dismiss}>
            <Text variant="bodySm" align="center">
              Cancel
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
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
    maxHeight: '90%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: color.border,
    alignSelf: 'center',
    marginVertical: space.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    color: color.textPrimary,
    fontSize: 16,
  },
  textarea: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.full,
    backgroundColor: color.surfaceAlt,
    borderWidth: 1,
    borderColor: color.border,
  },
  chipActive: {
    backgroundColor: color.primary,
    borderColor: color.primary,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: color.surfaceAlt,
    borderRadius: radius.full,
    padding: 4,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: space.sm,
    alignItems: 'center',
    borderRadius: radius.full,
  },
  segmentActive: {
    backgroundColor: color.primary,
  },
  dismiss: {
    paddingVertical: space.md,
  },
});
