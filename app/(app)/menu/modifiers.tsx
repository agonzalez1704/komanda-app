import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchAllModifiers } from '@/insforge/queries/menu';
import { useUpsertModifier } from '@/mutations/useUpsertModifier';
import { useDeleteModifier } from '@/mutations/useDeleteModifier';
import type { ModifierRowT } from '@/insforge/schemas';
import {
  Button,
  Card,
  Divider,
  EmptyState,
  GlassSurface,
  IconButton,
  Screen,
  Text,
  TextField,
} from '@/components/ui';
import {
  color,
  fontWeight,
  hitSlop,
  radius,
  space,
} from '@/theme/tokens';

export default function Modifiers() {
  const router = useRouter();
  const qc = useQueryClient();
  const modifiers = useQuery({
    queryKey: ['modifiers', 'all'],
    queryFn: fetchAllModifiers,
  });
  const upsert = useUpsertModifier();
  const remove = useDeleteModifier();

  const [newName, setNewName] = useState('');

  async function addOne() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setNewName('');
    await upsert.mutateAsync({ name: trimmed, active: true });
  }

  async function toggle(mod: ModifierRowT) {
    await upsert.mutateAsync({
      id: mod.id,
      name: mod.name,
      active: !mod.active,
    });
  }

  function confirmRemove(mod: ModifierRowT) {
    Alert.alert(
      'Remove modifier?',
      `"${mod.name}" won't appear on new items. Past komandas keep their records.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await remove.mutateAsync(mod.id);
            await qc.invalidateQueries({ queryKey: ['modifiers'] });
          },
        },
      ],
    );
  }

  const rows = modifiers.data ?? [];

  return (
    <Screen
      padded={false}
      scrollable
      avoidKeyboard
      edges={['top', 'bottom']}
      contentContainerStyle={{ paddingBottom: space.xxl }}
    >
      {/* Floating glass nav pill — back chevron + eyebrow/title. */}
      <View style={styles.hdrPad}>
        <GlassSurface radius={radius.xxl} contentStyle={styles.hdrInner}>
          <IconButton
            glass
            name="chevron-back"
            onPress={() => router.back()}
            accessibilityLabel="Back"
          />
          <View style={{ flex: 1, paddingLeft: space.xs }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: fontWeight.bold,
                color: color.textTertiary,
                textTransform: 'uppercase',
                letterSpacing: 0.8,
              }}
            >
              Used across all products
            </Text>
            <Text variant="h3" numberOfLines={1}>
              Modifiers
            </Text>
          </View>
        </GlassSurface>
      </View>

      <View style={styles.body}>
        <Card>
          <Text variant="label" style={{ marginBottom: space.sm }}>
            Add modifier
          </Text>
          <View style={styles.addRow}>
            <TextField
              placeholder="e.g. extra cheese"
              value={newName}
              onChangeText={setNewName}
              onSubmitEditing={addOne}
              returnKeyType="done"
              containerStyle={{ flex: 1 }}
            />
            <Button
              label="Add"
              size="md"
              variant="secondary"
              fullWidth={false}
              onPress={addOne}
              disabled={!newName.trim() || upsert.isPending}
            />
          </View>
        </Card>

        <View style={styles.group}>
          <Text variant="label">All modifiers</Text>
          {modifiers.isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={color.primary} />
            </View>
          ) : rows.length === 0 ? (
            <Card>
              <EmptyState
                icon="options-outline"
                title="No modifiers yet"
                subtitle="Add toppings, preparations, or options above."
              />
            </Card>
          ) : (
            <Card padded={false}>
              {rows.map((m, idx) => (
                <View key={m.id}>
                  <View style={styles.row}>
                    <Text
                      variant="body"
                      style={[
                        { flex: 1 },
                        !m.active && { color: color.textTertiary, textDecorationLine: 'line-through' },
                      ]}
                    >
                      {m.name}
                    </Text>
                    <Switch
                      value={m.active}
                      onValueChange={() => toggle(m)}
                      trackColor={{ true: color.primary, false: color.border }}
                      thumbColor={color.surface}
                    />
                    <Pressable
                      onPress={() => confirmRemove(m)}
                      hitSlop={hitSlop}
                      style={({ pressed }) => [
                        styles.removeBtn,
                        pressed && { opacity: 0.6 },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${m.name}`}
                    >
                      <Ionicons name="close" size={16} color={color.danger} />
                    </Pressable>
                  </View>
                  {idx < rows.length - 1 ? (
                    <Divider style={{ marginLeft: space.lg }} />
                  ) : null}
                </View>
              ))}
            </Card>
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Floating glass nav — inset so WarmCanvas wraps the corners.
  hdrPad: {
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
    paddingBottom: space.sm,
  },
  hdrInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    minHeight: 60,
  },
  body: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    gap: space.lg,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
  },
  group: { gap: space.sm },
  loading: {
    paddingVertical: space.xl,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    minHeight: 52,
  },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.dangerBg,
  },
});
